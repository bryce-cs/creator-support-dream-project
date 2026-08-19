// Admin session auth.
//
// One shared password (ADMIN_PASSWORD) exchanged for a signed, httpOnly cookie.
// The cookie carries an expiry and an HMAC over it, so it can't be forged or
// extended client-side, and it is never readable from JavaScript.
//
// If ADMIN_PASSWORD is unset the admin surface is disabled outright — an
// unprotected page that edits live site content is worse than no page.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "cs_admin";
const SESSION_DAYS = 7;

export function adminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && pw.length > 0 ? pw : null;
}

export function isAdminEnabled(): boolean {
  return adminPassword() !== null;
}

/**
 * Signing key. Derived from the password unless ADMIN_SESSION_SECRET is set, so
 * the common case needs one env var — and changing the password automatically
 * invalidates every existing session.
 */
function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || `session:${adminPassword() ?? ""}`;
}

function sign(expiresAt: number): string {
  return createHmac("sha256", secret()).update(String(expiresAt)).digest("hex");
}

/** Compare without leaking length or position through timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function checkPassword(input: unknown): boolean {
  const expected = adminPassword();
  if (!expected || typeof input !== "string") return false;
  return safeEqual(input, expected);
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expiresRaw, mac] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || !mac) return false;
  if (expiresAt < now) return false;
  return safeEqual(mac, sign(expiresAt));
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

/** True when the current request carries a valid admin session. */
export async function isAdminRequest(): Promise<boolean> {
  if (!isAdminEnabled()) return false;
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}
