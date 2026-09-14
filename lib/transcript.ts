// Fetch a YouTube video's transcript.
//
// YouTube refuses caption requests from datacenter IPs like Railway's ("sign in
// to confirm you're not a bot"), so in production transcripts come from the
// Funk Machine — the YT downloader's server — whose /api/transcript runs yt-dlp
// behind cookies and a proxy, which is what actually gets past that check.
//
// When FUNK_API_KEY isn't set, this falls back to asking YouTube directly via
// the player endpoint the Android app uses. That needs no key and works from a
// home connection, so local development still works without the Funk Machine.

import "server-only";

const FUNK_DEFAULT_URL = "https://funk-machine-web-production.up.railway.app";
const PLAYER = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const CLIENT_VERSION = "20.10.38";

/** A problem with this one video: no captions, private, removed. */
export class TranscriptError extends Error {}

/**
 * A problem with the transcript source itself — bad key, bot-blocked, rate
 * limited. Every other video would fail the same way, so a bulk run stops.
 */
export class TranscriptApiError extends Error {}

export async function fetchTranscript(videoId: string): Promise<string> {
  const key = process.env.FUNK_API_KEY;
  return key ? fromFunk(videoId, key) : fromYouTube(videoId);
}

// ─── Funk Machine ───

/** Funk Machine error codes that are about the server, not the video. */
const FUNK_FATAL = new Set(["unauthorized", "bot_check", "js_challenge", "stale_session", "rate_limited"]);

async function fromFunk(videoId: string, key: string): Promise<string> {
  const base = (process.env.FUNK_URL || FUNK_DEFAULT_URL).replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/api/transcript`, {
      method: "POST",
      cache: "no-store",
      // yt-dlp starts a process and solves YouTube's challenges; allow for it.
      signal: AbortSignal.timeout(90_000),
      headers: { "Content-Type": "application/json", "X-Funk-Key": key },
      body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
    });
  } catch (err) {
    throw new TranscriptApiError(
      `Couldn't reach the Funk Machine at ${base} (${err instanceof Error ? err.message : String(err)}).`,
    );
  }

  const data = await res.json().catch(() => null);
  if (res.ok && typeof data?.text === "string") {
    const text = data.text.replace(/\s+/g, " ").trim();
    if (!text) throw new TranscriptError("This video's captions are empty.");
    return text;
  }

  const code: string = data?.code ?? "";
  if (res.status === 401 || code === "unauthorized") {
    throw new TranscriptApiError("The Funk Machine rejected FUNK_API_KEY. It must match that server's FUNK_API_KEY.");
  }
  const message = [data?.error, data?.hint].filter(Boolean).join(" ") || `Funk Machine returned ${res.status}.`;
  if (code === "no_subs") throw new TranscriptError("This video has no captions, so there's no transcript to read.");
  // An uncoded 5xx is the server falling over, not a verdict on the video.
  if (FUNK_FATAL.has(code) || (res.status >= 500 && !code)) {
    throw new TranscriptApiError(`Funk Machine: ${message}`);
  }
  throw new TranscriptError(message);
}

// ─── Direct from YouTube (local fallback) ───

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  /** "asr" for auto-generated; absent for uploaded captions. */
  kind?: string;
}

async function fromYouTube(videoId: string): Promise<string> {
  const res = await fetch(PLAYER, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 14)`,
    },
    body: JSON.stringify({
      context: {
        client: { clientName: "ANDROID", clientVersion: CLIENT_VERSION, androidSdkVersion: 34, hl: "en" },
      },
      videoId,
    }),
  });
  if (!res.ok) throw new TranscriptError(`YouTube returned ${res.status} for this video.`);

  const player = await res.json();
  const playability = player?.playabilityStatus;
  if (playability?.status === "LOGIN_REQUIRED") {
    // From a server this is almost always the bot check, and it hits every video.
    throw new TranscriptApiError(
      "YouTube is blocking this server from reading captions. Set FUNK_API_KEY so transcripts go through the Funk Machine.",
    );
  }
  if (playability?.status && playability.status !== "OK") {
    throw new TranscriptError(
      `YouTube says this video is unavailable${playability.reason ? `: ${playability.reason}` : "."}`,
    );
  }

  const tracks: CaptionTrack[] =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = pickTrack(tracks);
  if (!track) throw new TranscriptError("This video has no captions, so there's no transcript to read.");

  const xml = await fetch(track.baseUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!xml.ok) throw new TranscriptError(`Couldn't download captions (${xml.status}).`);
  const text = captionsToText(await xml.text());
  if (!text) throw new TranscriptError("This video's captions are empty.");
  return text;
}

/** English uploaded captions, then English auto, then any uploaded, then anything. */
function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const en = (t: CaptionTrack) => t.languageCode === "en" || t.languageCode.startsWith("en-");
  return (
    tracks.find((t) => en(t) && t.kind !== "asr") ??
    tracks.find((t) => en(t)) ??
    tracks.find((t) => t.kind !== "asr") ??
    tracks[0]
  );
}

/**
 * The timedtext XML as one block of text. Cues are <p> elements; auto captions
 * split words into <s> children, which the tag strip joins back together.
 */
function captionsToText(xml: string): string {
  const cues = [...xml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(),
  );
  return cues.filter(Boolean).join(" ");
}

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
