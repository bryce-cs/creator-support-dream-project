import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { diffOverride, isEmptyOverride, parseOverride } from "@/lib/overrides";
import { saveOverride } from "@/lib/overrides-server";
import { loadAllSubmissions, loadBaseSubmissions } from "@/lib/submissions-server";

export const dynamic = "force-dynamic";

/**
 * Save one submission's overrides.
 *
 * The client posts the values it wants displayed; the diff against what
 * Typeform currently supplies is computed here, and only the differences are
 * stored. That's what keeps untouched fields tracking Typeform automatically.
 */
export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: { id?: unknown; fields?: unknown; reset?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing submission id." }, { status: 400 });

  if (body.reset === true) {
    await saveOverride(id, {});
    return NextResponse.json({ ok: true, override: null });
  }

  // Diff against the raw source values, not the already-overridden ones, or a
  // saved edit would compare equal to itself and immediately delete itself.
  const base = await loadBaseSubmissions();
  const original = base.find((s) => s.id === id);
  if (!original) {
    return NextResponse.json({ error: "Unknown submission." }, { status: 404 });
  }

  const override = diffOverride(original, parseOverride(body.fields));
  await saveOverride(id, override);
  return NextResponse.json({ ok: true, override: isEmptyOverride(override) ? null : override });
}

/** Current admin view of every submission, hidden ones included. */
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  return NextResponse.json({ submissions: await loadAllSubmissions() });
}
