import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  checkPassword,
  createSessionToken,
  isAdminEnabled,
  sessionCookieOptions,
} from "@/lib/admin-auth";

/** Exchange the admin password for a signed session cookie. */
export async function POST(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: "Admin is not configured." }, { status: 503 });
  }

  let password: unknown;
  try {
    password = (await request.json())?.password;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (!checkPassword(password)) {
    // Blunt throttle: a wrong password costs a second, so guessing the whole
    // space over HTTP is impractical without a rate-limiter in front.
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), sessionCookieOptions);
  return res;
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
