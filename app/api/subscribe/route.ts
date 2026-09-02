import { NextResponse } from "next/server";
import { subscribeToKit } from "@/lib/kit";

// Loose on purpose: real deliverability is Kit's job. This only rejects the
// obvious typos so we don't spend a round trip on "bryce" or "a@b".
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Add an email to the Kit form behind the /live workshop signup. */
export async function POST(request: Request) {
  let email: unknown;
  try {
    email = (await request.json())?.email;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await subscribeToKit(email.trim());
  if (result.ok) return NextResponse.json({ ok: true });

  return NextResponse.json({ error: result.message }, { status: result.status });
}
