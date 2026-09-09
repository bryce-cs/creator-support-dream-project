import { NextResponse } from "next/server";
import { subscribeToKit } from "@/lib/kit";

// Loose on purpose: real deliverability is Kit's job. This only rejects the
// obvious typos so we don't spend a round trip on "bryce" or "a@b".
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Same idea for the channel. People paste all sorts of things — a full URL, a
// bare youtube.com/@handle, or just "@handle" — and all of them are findable,
// so the only thing worth rejecting is a value that can't be either.
const CHANNEL = /^(@[\w.-]{2,}|.*\.[a-z]{2,}.*)$/i;

// The open question is free text, so the only thing worth enforcing is a
// ceiling — Kit caps custom field values, and nobody types an essay by accident.
const PROBLEM_MAX = 1000;

/** Take a channel submission for the live audit and add it to the Kit form. */
export async function POST(request: Request) {
  let body: { email?: unknown; channel?: unknown; problem?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const channel = typeof body.channel === "string" ? body.channel.trim() : "";
  // Optional: a blank answer shouldn't cost someone their submission.
  const problem =
    typeof body.problem === "string" ? body.problem.trim().slice(0, PROBLEM_MAX) : "";

  if (!CHANNEL.test(channel) || channel.length > 500) {
    return NextResponse.json(
      { error: "Add a link to your channel so we can find it." },
      { status: 400 },
    );
  }

  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await subscribeToKit(email, { channel, problem });
  if (result.ok) return NextResponse.json({ ok: true });

  return NextResponse.json({ error: result.message }, { status: result.status });
}
