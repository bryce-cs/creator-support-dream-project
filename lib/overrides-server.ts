// Reads and writes the admin override file.
//
// The site runs as a long-lived Node server, so a JSON file on disk is enough.
// Point OVERRIDES_PATH at your persistent volume if the working directory is
// not persistent — on a host with an ephemeral filesystem, saves would appear
// to work and then vanish on the next deploy.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { parseOverrides, type Override, type Overrides } from "./overrides";

const OVERRIDES_PATH =
  process.env.OVERRIDES_PATH || path.join(process.cwd(), "data", "overrides.json");

export async function readOverrides(): Promise<Overrides> {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, "utf8");
    return parseOverrides(JSON.parse(raw));
  } catch (err) {
    // A missing file just means nothing has been overridden yet.
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error("Failed to read overrides:", err);
    }
    return {};
  }
}

/**
 * Writes are serialized through this promise chain. Only one admin is expected,
 * but two saves landing at once would otherwise interleave read-modify-write and
 * lose an edit.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/** Replace one submission's override. An empty override removes the entry. */
export function saveOverride(id: string, override: Override): Promise<Overrides> {
  return enqueue(async () => {
    const all = await readOverrides();
    if (Object.keys(override).length === 0) delete all[id];
    else all[id] = override;
    await writeOverrides(all);
    return all;
  });
}

async function writeOverrides(all: Overrides): Promise<void> {
  await fs.mkdir(path.dirname(OVERRIDES_PATH), { recursive: true });
  // Write-then-rename so a crash mid-write can't leave truncated JSON behind.
  const tmp = `${OVERRIDES_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  await fs.rename(tmp, OVERRIDES_PATH);
}

export { OVERRIDES_PATH };
