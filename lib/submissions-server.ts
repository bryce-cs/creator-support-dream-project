// Server-only loader. Reads data/submissions.json from disk.

import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Submission } from "./submissions";

const DATA_PATH = path.join(process.cwd(), "data", "submissions.json");

export function loadSubmissions(): Submission[] {
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
