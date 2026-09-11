import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { rowKey } from "@/lib/live-submissions";
import { updateLiveSubmissions } from "@/lib/live-submissions-server";

export const dynamic = "force-dynamic";

/**
 * Tick or untick one channel submission's shortlist box.
 *
 * Goes through updateLiveSubmissions, inside the same write queue as new
 * submissions and subscriber checks, so a tick can't race either and undo it.
 * Rows have no id, so the client names the row by rowKey (arrival time + email).
 */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: { key?: unknown; shortlisted?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { key, shortlisted } = body;
  if (typeof key !== "string" || typeof shortlisted !== "boolean") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  let found = false;
  await updateLiveSubmissions((all) =>
    all.map((r) => {
      if (rowKey(r) !== key) return r;
      found = true;
      // Drop the field when unticking rather than storing false, so the file
      // only records the rows someone actually chose.
      const { shortlisted: _drop, ...rest } = r;
      return shortlisted ? { ...rest, shortlisted: true } : rest;
    }),
  );

  if (!found) {
    return NextResponse.json({ error: "That submission no longer exists." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, shortlisted });
}
