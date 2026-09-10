import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { rowKey, type YouTubeStats } from "@/lib/live-submissions";
import { readLiveSubmissions, updateLiveSubmissions } from "@/lib/live-submissions-server";
import { lookupChannel, youtubeApiKey, YouTubeApiError } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// Rows per request. The admin page calls this in a loop until nothing is left,
// so each request stays short and the button can show progress.
const BATCH = 20;
const CONCURRENCY = 5;

/**
 * Check subscriber counts for the /live channel submissions, one batch at a time.
 *
 * A run is identified by `since`, which the SERVER hands out on the first call
 * and the client echoes back. A row is due if it has never been checked or was
 * last checked before `since`. Using server time for both sides means a client
 * clock that runs fast can't make freshly checked rows look stale forever, and
 * a submission arriving mid-run just gets checked too.
 */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!youtubeApiKey()) {
    return NextResponse.json(
      { error: "Set YOUTUBE_API_KEY on the server to check subscriber counts." },
      { status: 503 },
    );
  }

  let since: string;
  try {
    const body = await request.json().catch(() => ({}));
    since = typeof body?.since === "string" ? body.since : new Date().toISOString();
    if (Number.isNaN(Date.parse(since))) throw new Error();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const rows = await readLiveSubmissions();
  const due = rows.filter((r) => !r.youtube || r.youtube.checkedAt < since);
  const batch = due.slice(0, BATCH);

  // Several people can submit the same channel; look each one up once.
  const channels = [...new Set(batch.map((r) => r.channel))];
  const results = new Map<string, YouTubeStats>();

  try {
    await eachLimit(channels, CONCURRENCY, async (channel) => {
      results.set(channel, await check(channel));
    });
  } catch (err) {
    if (err instanceof YouTubeApiError) {
      // Key or quota trouble dooms every remaining lookup, so stop the run and
      // leave the rest unchecked for next time rather than stamping them "error".
      await save(batch, results);
      return NextResponse.json({ error: explain(err) }, { status: 502 });
    }
    throw err;
  }

  await save(batch, results);
  return NextResponse.json({ checked: batch.length, remaining: due.length - batch.length, since });
}

/** One link's result. Per-link failures are recorded; key/quota errors throw. */
async function check(channel: string): Promise<YouTubeStats> {
  const checkedAt = new Date().toISOString();
  try {
    const found = await lookupChannel(channel);
    if (found.status !== "ok") return { checkedAt, status: found.status };
    return {
      checkedAt,
      status: "ok",
      subscribers: found.subscribers,
      title: found.title,
      channelId: found.channelId,
      ...(found.matchedBySearch ? { matchedBySearch: true } : {}),
    };
  } catch (err) {
    if (err instanceof YouTubeApiError) throw err;
    // A timeout or network blip is this link's problem. Recording it (rather
    // than skipping) is what stops the run retrying it forever.
    return { checkedAt, status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

async function save(
  batch: { at: string; email: string; channel: string }[],
  results: Map<string, YouTubeStats>,
) {
  const byKey = new Map<string, YouTubeStats>();
  for (const r of batch) {
    const stats = results.get(r.channel);
    if (stats) byKey.set(rowKey(r), stats);
  }
  if (byKey.size === 0) return;
  await updateLiveSubmissions((all) =>
    all.map((r) => {
      const stats = byKey.get(rowKey(r));
      return stats ? { ...r, youtube: stats } : r;
    }),
  );
}

function explain(err: YouTubeApiError): string {
  switch (err.reason) {
    case "quotaExceeded":
    case "dailyLimitExceeded":
      return "YouTube's daily API quota is used up. It resets at midnight Pacific; try again then.";
    case "keyInvalid":
    case "badRequest":
      return "YouTube rejected YOUTUBE_API_KEY. Check the value on the server.";
    case "accessNotConfigured":
    case "SERVICE_DISABLED":
      return "YouTube Data API v3 isn't enabled for this key's Google Cloud project.";
    default:
      return `YouTube API error (${err.httpStatus} ${err.reason}): ${err.message}`;
  }
}

/** Run fn over items with at most `limit` in flight. Rejects on the first error. */
async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}
