import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { PICK_LISTS, rowKey, type PickList } from "@/lib/live-submissions";
import { updateLiveSubmissions } from "@/lib/live-submissions-server";

export const dynamic = "force-dynamic";

/**
 * Tick or untick one channel submission on one list (Live or Show).
 *
 * Goes through updateLiveSubmissions, inside the same write queue as new
 * submissions and subscriber checks, so a tick can't race either and undo it.
 * Rows have no id, so the client names the row by rowKey (arrival time + email).
 */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: { key?: unknown; list?: unknown; on?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { key, list, on } = body;
  if (
    typeof key !== "string" ||
    typeof on !== "boolean" ||
    !PICK_LISTS.includes(list as PickList)
  ) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const which = list as PickList;

  let found = false;
  await updateLiveSubmissions((all) =>
    all.map((r) => {
      if (rowKey(r) !== key) return r;
      found = true;
      const picks = { ...r.picks };
      // Remove rather than store false, so the file only records real choices.
      if (on) picks[which] = true;
      else delete picks[which];
      const { picks: _old, ...rest } = r;
      return Object.keys(picks).length > 0 ? { ...rest, picks } : rest;
    }),
  );

  if (!found) {
    return NextResponse.json({ error: "That submission no longer exists." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
