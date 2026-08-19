// Server-only loader.
// If TYPEFORM_TOKEN is set, pulls live submissions from the Typeform Responses API.
// Otherwise falls back to data/submissions.json from disk (useful for local dev).
// Admin overrides from data/overrides.json are layered on top of either source.

import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Submission } from "./submissions";
import { fetchTypeformResponses } from "./typeform";
import { applyOverrides } from "./overrides";
import { readOverrides } from "./overrides-server";

const DATA_PATH = path.join(process.cwd(), "data", "submissions.json");

/**
 * Every submission, including the ones hidden by a Typeform tag or an admin
 * toggle, each carrying a `hidden` flag. For /admin only — hidden rows must not
 * be sent to the public page.
 */
export async function loadAllSubmissions(): Promise<Submission[]> {
  const base = await loadBaseSubmissions();
  const overrides = await readOverrides();
  return applyOverrides(base, overrides);
}

/**
 * Submissions exactly as the source supplies them, with no overrides applied.
 *
 * The admin save path diffs against this: comparing against the already-
 * overridden values would make every saved edit look like "no change" and
 * delete itself on the next save.
 */
export async function loadBaseSubmissions(): Promise<Submission[]> {
  // null means Typeform was unreachable — fall back to disk. An empty array is a
  // real answer (nothing submitted yet) and is returned as-is, so hiding the
  // last visible response doesn't resurrect the JSON fixture.
  const fromTypeform = await fetchTypeformResponses();
  return fromTypeform !== null ? fromTypeform : loadFromJson();
}

/** What the public /submissions page renders: hidden rows removed server-side. */
export async function loadSubmissions(): Promise<Submission[]> {
  const all = await loadAllSubmissions();
  return all.filter((s) => !s.hidden);
}

function loadFromJson(): Submission[] {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSubmission);
  } catch {
    return [];
  }
}

function isValidSubmission(s: unknown): s is Submission {
  if (typeof s !== "object" || s === null) return false;
  const v = s as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.name === "string" &&
    typeof v.youtube_url === "string" &&
    typeof v.submitted_at === "string"
  );
}
