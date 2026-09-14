// Summaries of each idea submission's video, shown and edited on /admin.
//
// Kept in their own file for the same reason as the shortlist: overrides.json
// is rebuilt from scratch by every Save and by "Reset to Typeform", and a
// summary someone spent a minute fixing must survive both. Defaults to sitting
// next to the overrides file, so it lands on the volume with everything else.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { IdeaSummaries, IdeaSummary } from "./idea-summaries";

export function ideaSummariesPath(): string {
  const explicit = process.env.IDEA_SUMMARIES_PATH;
  if (explicit) return explicit;
  const overrides = process.env.OVERRIDES_PATH;
  const dir = overrides ? path.dirname(overrides) : path.join(process.cwd(), "data");
  return path.join(dir, "idea-summaries.json");
}

/** Keyed by submission id. Empty on a missing or unreadable file. */
export async function readIdeaSummaries(): Promise<IdeaSummaries> {
  try {
    const parsed = JSON.parse(await fs.readFile(ideaSummariesPath(), "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: IdeaSummaries = {};
    for (const [id, v] of Object.entries(parsed as Record<string, Partial<IdeaSummary>>)) {
      if (typeof v?.text === "string" && v.text) {
        out[id] = { text: v.text, source: v.source === "ai" ? "ai" : "edited", at: String(v.at ?? "") };
      }
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error("Failed to read idea summaries:", err);
    }
    return {};
  }
}

// Serialized so a bulk run and a hand edit landing together can't lose one.
let queue: Promise<unknown> = Promise.resolve();

/** Set one submission's summary. Null (or blank text) removes it. */
export function setIdeaSummary(id: string, summary: IdeaSummary | null): Promise<void> {
  const run = queue.then(async () => {
    const all = await readIdeaSummaries();
    if (summary && summary.text.trim()) all[id] = summary;
    else delete all[id];
    const target = ideaSummariesPath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(all, null, 2)}\n`, "utf8");
    await fs.rename(tmp, target);
  });
  queue = run.catch(() => {});
  return run;
}
