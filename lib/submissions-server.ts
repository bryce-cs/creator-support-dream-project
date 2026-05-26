// Server-only loader.
// If TYPEFORM_TOKEN is set, pulls live submissions from the Typeform Responses API.
// Otherwise falls back to data/submissions.json from disk (useful for local dev).

import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Submission } from "./submissions";
import { fetchTypeformResponses } from "./typeform";

const DATA_PATH = path.join(process.cwd(), "data", "submissions.json");

export async function loadSubmissions(): Promise<Submission[]> {
  if (process.env.TYPEFORM_TOKEN) {
    const fromTypeform = await fetchTypeformResponses();
    if (fromTypeform.length > 0) return fromTypeform;
    // If Typeform returned empty (e.g. transient failure), still try the JSON fallback.
  }
  return loadFromJson();
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
