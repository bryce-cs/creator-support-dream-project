// Proxy for Typeform-hosted file uploads (e.g. submission thumbnails).
// Those URLs require the API token, so they can't be used directly as an <img src>.
// Only api.typeform.com form-file URLs are allowed through.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u");
  if (!raw) return new NextResponse("Missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("Bad url", { status: 400 });
  }

  if (target.protocol !== "https:" || target.hostname !== "api.typeform.com" || !target.pathname.startsWith("/forms/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const token = process.env.TYPEFORM_TOKEN;
  if (!token) return new NextResponse("Not configured", { status: 503 });

  const upstream = await fetch(target.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 86400 },
  });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 });
  }

  const type = upstream.headers.get("content-type") || "application/octet-stream";
  // Only serve images — the upload field could in theory receive anything.
  if (!type.startsWith("image/")) return new NextResponse("Unsupported", { status: 415 });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
