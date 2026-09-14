// The shortlist on the /admin Idea submissions tab: a set of Typeform response
// ids, kept in its own file rather than in overrides.json.
//
// Overrides describe how a card *renders*, and both "Reset to Typeform" and
// every Save rebuild a submission's override from scratch — a shortlist tick
// stored there would be silently wiped by either. Kept apart, it's untouched.
//
// Like live-submissions.json, the file defaults to sitting next to the
// overrides file, so once OVERRIDES_PATH is on the volume this is too.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

export function ideaShortlistPath(): string {
  const explicit = process.env.IDEA_SHORTLIST_PATH;
  if (explicit) return explicit;
  const overrides = process.env.OVERRIDES_PATH;
  const dir = overrides ? path.dirname(overrides) : path.join(process.cwd(), "data");
  return path.join(dir, "idea-shortlist.json");
}

/** Shortlisted submission ids. Empty on a missing or unreadable file. */
export async function readIdeaShortlist(): Promise<string[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(ideaShortlistPath(), "utf8"));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error("Failed to read idea shortlist:", err);
    }
    return [];
  }
}

// Serialized so two ticks landing together can't interleave and lose one.
let queue: Promise<unknown> = Promise.resolve();

export function setIdeaShortlisted(id: string, on: boolean): Promise<void> {
  const run = queue.then(async () => {
    const ids = new Set(await readIdeaShortlist());
    if (on) ids.add(id);
    else ids.delete(id);
    const target = ideaShortlistPath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify([...ids], null, 2)}\n`, "utf8");
    await fs.rename(tmp, target);
  });
  queue = run.catch(() => {});
  return run;
}
