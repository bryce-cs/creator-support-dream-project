import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { setIdeaShortlisted } from "@/lib/idea-shortlist-server";
import { loadBaseSubmissions } from "@/lib/submissions-server";

export const dynamic = "force-dynamic";

/** Tick or untick one idea submission's shortlist box. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: { id?: unknown; on?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { id, on } = body;
  if (typeof id !== "string" || !id || id.length > 200 || typeof on !== "boolean") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Only ticking needs a real submission; unticking a stale id should always
  // succeed, so an entry for a deleted response can still be cleared.
  if (on && !(await loadBaseSubmissions()).some((s) => s.id === id)) {
    return NextResponse.json({ error: "Unknown submission." }, { status: 404 });
  }

  await setIdeaShortlisted(id, on);
  return NextResponse.json({ ok: true });
}
