// Write a one-sentence summary of an idea submission from its video transcript.
//
// Calls the Anthropic Messages API directly with fetch, like canopy's lib/ai.ts,
// so there's no SDK dependency to add. Haiku by default: this is a short, plain
// summary and the bulk button may run it over every submission.

import "server-only";

const API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/** Enough for a long pitch video; beyond this the summary won't get better. */
const TRANSCRIPT_MAX = 40_000;

export function anthropicApiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY;
  return key && key.length > 0 ? key : null;
}

/** A problem with the key, quota or service rather than with one video. Stops a bulk run. */
export class SummarizeApiError extends Error {}

export async function summarizeTranscript(
  transcript: string,
  context: { title: string; name: string },
): Promise<string> {
  const key = anthropicApiKey();
  if (!key) throw new SummarizeApiError("Set ANTHROPIC_API_KEY on the server to generate summaries.");

  const res = await fetch(API, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 120,
      system:
        "You summarize video submissions to the Big Idea Fund, where YouTube creators pitch a video idea they want to make. " +
        "Write exactly one plain sentence for the team reviewing submissions: what the idea is, plus its angle if one stands out. " +
        "Keep it under 35 words. Use only what the transcript says. " +
        "No preamble, no heading, no quotation marks around the summary.",
      messages: [
        {
          role: "user",
          content:
            `Submission title: ${context.title || "(none)"}\nCreator: ${context.name || "(unknown)"}\n\n` +
            `Transcript:\n${transcript.slice(0, TRANSCRIPT_MAX)}`,
        },
      ],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message: string = data?.error?.message ?? `Anthropic API returned ${res.status}`;
    if (res.status === 401) throw new SummarizeApiError("Anthropic rejected ANTHROPIC_API_KEY. Check the value on the server.");
    throw new SummarizeApiError(`Anthropic API error (${res.status}): ${message}`);
  }

  const text = (data?.content ?? [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("")
    .trim();
  if (!text) throw new SummarizeApiError("Anthropic returned an empty summary.");
  return text;
}
