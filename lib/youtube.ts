// Resolve a submitted channel link to a YouTube channel and its subscriber count.
//
// Adapted from canopy's lib/youtube.ts (YouTube Data API v3, YOUTUBE_API_KEY),
// with two deliberate differences:
//
//   - An @handle that doesn't exist is reported as "not found", not guessed at.
//     canopy falls back to a free-text search for any failed handle, which on a
//     typo returns whatever channel ranks first — a confident, wrong number.
//     Search is kept only for legacy /c/ and bare custom URLs, which have no
//     exact lookup, and those results are flagged so the admin can eyeball them.
//
//   - Video links (watch, shorts, youtu.be, live) resolve to their channel,
//     since people paste a video when asked for a channel all the time.
//
// Quota: an exact lookup costs 1 unit, a video link 2, a search fallback 101,
// against a default 10,000/day. Plenty for this page.

import "server-only";

const API = "https://www.googleapis.com/youtube/v3";

export function youtubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY;
  return key && key.length > 0 ? key : null;
}

export type ChannelLookup =
  | {
      status: "ok";
      /** null when the channel hides its count. */
      subscribers: number | null;
      title: string;
      channelId: string;
      /** Found by free-text search, so it may be the wrong channel. */
      matchedBySearch: boolean;
    }
  | { status: "not-youtube" }
  | { status: "not-found" };

/**
 * A problem with the key or the quota rather than with any one link. Callers
 * should stop the whole run on this — every remaining lookup would fail too.
 */
export class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly reason: string,
    readonly httpStatus: number,
  ) {
    super(message);
  }
}

type Ref =
  | { kind: "handle"; value: string }
  | { kind: "id"; value: string }
  | { kind: "username"; value: string }
  | { kind: "custom"; value: string }
  | { kind: "video"; value: string };

// First path segments that are YouTube pages, not channel names.
const RESERVED = new Set([
  "watch", "playlist", "shorts", "feed", "gaming", "music", "premium", "results",
  "embed", "live", "hashtag", "channel", "c", "user", "account", "about", "t",
]);

/**
 * Work out what a submitted value points at. Returns "not-youtube" for links to
 * other platforms (the field asks for a channel *or profile* link, so TikTok and
 * Instagram links are expected), and null for a YouTube link with no channel in
 * it, like a bare youtube.com.
 */
export function parseChannelRef(input: string): Ref | "not-youtube" | null {
  const raw = input.trim();
  if (!raw) return null;

  // A bare handle, which the form explicitly accepts.
  if (raw.startsWith("@")) return { kind: "handle", value: raw.slice(1) };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? { kind: "video", value: id } : null;
  }
  if (host !== "youtube.com" && host !== "music.youtube.com") return "not-youtube";

  const v = url.searchParams.get("v");
  if (url.pathname === "/watch" && v) return { kind: "video", value: v };

  const [first, second] = url.pathname.split("/").filter(Boolean).map(safeDecode);
  if (!first) return null;

  if (first.startsWith("@")) return { kind: "handle", value: first.slice(1) };
  if (first === "channel" && second) return { kind: "id", value: second };
  if (first === "user" && second) return { kind: "username", value: second };
  if (first === "c" && second) return { kind: "custom", value: second };
  if ((first === "shorts" || first === "live" || first === "embed") && second) {
    return { kind: "video", value: second };
  }
  if (!RESERVED.has(first.toLowerCase())) return { kind: "custom", value: first };
  return null;
}

/** decodeURIComponent throws on a stray "%" — a submitted link must never do that. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Look one submitted link up. Throws YouTubeApiError on key/quota problems. */
export async function lookupChannel(input: string): Promise<ChannelLookup> {
  const key = youtubeApiKey();
  if (!key) throw new YouTubeApiError("YOUTUBE_API_KEY is not set.", "noKey", 0);

  const ref = parseChannelRef(input);
  if (ref === "not-youtube") return { status: "not-youtube" };
  if (!ref) return { status: "not-found" };

  switch (ref.kind) {
    case "handle":
      return found(await channels(key, { forHandle: `@${ref.value}` }));
    case "id":
      return found(await channels(key, { id: ref.value }));
    case "username":
      return found(await channels(key, { forUsername: ref.value }));
    case "video": {
      const video = await get(key, "videos", { part: "snippet", id: ref.value });
      const channelId = video?.items?.[0]?.snippet?.channelId;
      return channelId ? found(await channels(key, { id: channelId })) : { status: "not-found" };
    }
    case "custom": {
      // Most old custom URLs were migrated to a matching handle, so try that
      // exactly before paying for — and trusting — a search.
      const exact = await channels(key, { forHandle: `@${ref.value}` });
      if (exact) return found(exact);
      const search = await get(key, "search", {
        part: "snippet",
        type: "channel",
        q: ref.value,
        maxResults: "1",
      });
      const channelId = search?.items?.[0]?.snippet?.channelId;
      if (!channelId) return { status: "not-found" };
      return found(await channels(key, { id: channelId }), true);
    }
  }
}

interface ChannelItem {
  id: string;
  snippet?: { title?: string };
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
}

function found(item: ChannelItem | null, matchedBySearch = false): ChannelLookup {
  if (!item) return { status: "not-found" };
  const stats = item.statistics;
  return {
    status: "ok",
    subscribers:
      stats?.hiddenSubscriberCount || stats?.subscriberCount == null
        ? null
        : Number(stats.subscriberCount),
    title: item.snippet?.title ?? "",
    channelId: item.id,
    matchedBySearch,
  };
}

async function channels(key: string, params: Record<string, string>): Promise<ChannelItem | null> {
  const data = await get(key, "channels", { part: "snippet,statistics", ...params });
  return (data?.items?.[0] as ChannelItem | undefined) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get(key: string, resource: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${resource}?${qs}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return res.json();

  const body = await res.json().catch(() => null);
  const message: string = body?.error?.message ?? `YouTube API returned ${res.status}`;
  // Google reports an invalid key as a plain 400 "badRequest", same as a bad
  // parameter; the only tell is API_KEY_INVALID in the details. Missing it
  // would mark every row "not found" on a mistyped key instead of saying so.
  const keyInvalid = (body?.error?.details ?? []).some(
    (d: { reason?: string }) => d?.reason === "API_KEY_INVALID",
  );
  const reason: string = keyInvalid
    ? "keyInvalid"
    : (body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "unknown");

  // Otherwise a 400 is about the value we sent (a malformed handle, say), so
  // it's this one link's problem. Anything else — API not enabled, quota — is
  // the whole run's problem.
  if (res.status === 400 && !keyInvalid) return null;
  throw new YouTubeApiError(message, reason, res.status);
}
