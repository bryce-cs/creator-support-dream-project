// Reads and appends the /live channel submissions file.
//
// Same shape as overrides-server: a JSON file on disk, serialized writes,
// write-then-rename. The path defaults to sitting NEXT TO the overrides file
// rather than under the working directory, so once OVERRIDES_PATH points at a
// mounted volume this lands on that volume too and survives deploys without a
// second variable to remember. LIVE_SUBMISSIONS_PATH overrides it outright.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { LiveSubmission } from "./live-submissions";

/** Keep the newest this many. Far above any plausible volume for one workshop,
 *  low enough that the file can't grow without bound if the URL gets scraped. */
const MAX_ROWS = 5000;

export function liveSubmissionsPath(): string {
  const explicit = process.env.LIVE_SUBMISSIONS_PATH;
  if (explicit) return explicit;

  const overrides = process.env.OVERRIDES_PATH;
  const dir = overrides ? path.dirname(overrides) : path.join(process.cwd(), "data");
  return path.join(dir, "live-submissions.json");
}

/** Newest first. Returns an empty list rather than throwing — the admin page
 *  should still render if the file is missing or corrupt. */
export async function readLiveSubmissions(): Promise<LiveSubmission[]> {
  try {
    const raw = await fs.readFile(liveSubmissionsPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(upgrade) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error("Failed to read live submissions:", err);
    }
    return [];
  }
}

/**
 * Bring an older row up to the current shape. The Live box used to be the only
 * box, stored as `shortlisted: true`; it's now `picks.live`. Converted on every
 * read, and the next write persists the new shape, so existing ticks carry over
 * without a migration step.
 */
function upgrade(row: LiveSubmission & { shortlisted?: boolean }): LiveSubmission {
  if (!("shortlisted" in row)) return row;
  const { shortlisted, ...rest } = row;
  return shortlisted ? { ...rest, picks: { ...rest.picks, live: true } } : rest;
}

// Writes are serialized so two submissions landing together can't interleave
// read-modify-write and lose one.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/**
 * Append one submission.
 *
 * Never throws: a disk problem must not cost the visitor their signup, and the
 * Kit write has already happened by the time this runs. Failures are logged.
 */
export function recordLiveSubmission(entry: LiveSubmission): Promise<void> {
  return updateLiveSubmissions((all) => [entry, ...all]).catch((err) => {
    console.error("Failed to record live submission:", err, JSON.stringify(entry));
  });
}

/**
 * Read-modify-write the whole list inside the write queue. Anything that edits
 * existing rows must go through here, or it can race a new submission landing
 * and silently drop it.
 */
export function updateLiveSubmissions(
  fn: (all: LiveSubmission[]) => LiveSubmission[],
): Promise<void> {
  return enqueue(async () => {
    const all = await readLiveSubmissions();
    await write(fn(all).slice(0, MAX_ROWS));
  });
}

async function write(all: LiveSubmission[]): Promise<void> {
  const target = liveSubmissionsPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  // Write-then-rename so a crash mid-write can't leave truncated JSON behind.
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  await fs.rename(tmp, target);
}
