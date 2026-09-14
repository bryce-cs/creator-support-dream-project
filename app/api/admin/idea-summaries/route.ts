import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { SUMMARY_MAX } from "@/lib/idea-summaries";
import { readIdeaSummaries, setIdeaSummary } from "@/lib/idea-summaries-server";
import { extractYoutubeId } from "@/lib/submissions";
import { loadAllSubmissions } from "@/lib/submissions-server";
import { SummarizeApiError, summarizeTranscript } from "@/lib/summarize";
import { fetchTranscript, TranscriptApiError, TranscriptError } from "@/lib/transcript";

export const dynamic = "force-dynamic";
// A transcript fetch plus a model call can take a while on a long video.
export const maxDuration = 90;

/** Save a hand-edited summary. Blank text removes it. */
export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const id = body?.id;
  const text = body?.text;
  if (typeof id !== "string" || !id || id.length > 200 || typeof text !== "string") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const trimmed = text.trim().slice(0, SUMMARY_MAX);
  await setIdeaSummary(id, trimmed ? { text: trimmed, source: "edited", at: new Date().toISOString() } : null);
  return NextResponse.json({ ok: true });
}

/**
 * Generate one submission's summary from its video transcript.
 *
 * One submission per call, so the admin page can show progress through a bulk
 * run and a slow video can't time out the rest. Unless `overwrite` is set, a
 * summary someone edited by hand is left alone — that's what makes it safe for
 * "Summarize missing" to be clicked again later.
 *
 * Errors come back with `fatal: true` when every other video would fail the
 * same way (no key, bad key, quota), so a bulk run stops instead of grinding on.
 */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string" || !id || id.length > 200) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // With overrides applied, so a YouTube link fixed on /admin is the one read.
  const submission = (await loadAllSubmissions()).find((s) => s.id === id);
  if (!submission) return NextResponse.json({ error: "Unknown submission." }, { status: 404 });

  if (body?.overwrite !== true) {
    const existing = (await readIdeaSummaries())[id];
    if (existing?.source === "edited") {
      return NextResponse.json({ skipped: true, summary: existing });
    }
  }

  const videoId = extractYoutubeId(submission.youtube_url);
  if (!videoId) {
    return NextResponse.json({ error: "No YouTube video link on this submission." }, { status: 422 });
  }

  try {
    const transcript = await fetchTranscript(videoId);
    const text = await summarizeTranscript(transcript, { title: submission.title, name: submission.name });
    const summary = { text, source: "ai" as const, at: new Date().toISOString() };
    await setIdeaSummary(id, summary);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof TranscriptError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof SummarizeApiError || err instanceof TranscriptApiError) {
      return NextResponse.json({ error: err.message, fatal: true }, { status: 502 });
    }
    console.error("Summary generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Summary generation failed." },
      { status: 500 },
    );
  }
}
