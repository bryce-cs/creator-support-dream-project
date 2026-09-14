// Fetch a YouTube video's transcript from its caption tracks.
//
// The YouTube Data API can't download captions for videos you don't own, and
// yt-dlp (what the YT downloader uses) isn't installed on the server. The
// player endpoint the Android app calls lists every caption track with a
// direct URL, including auto-generated ones, and needs no key — so that's used
// here. It's undocumented: if YouTube changes it, or starts demanding sign-in
// from the server's IP, generating fails with a clear message and summaries
// can still be written by hand.

import "server-only";

const PLAYER = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const CLIENT_VERSION = "20.10.38";

/** A problem with this one video: no captions, private, removed, blocked. */
export class TranscriptError extends Error {}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  /** "asr" for auto-generated; absent for uploaded captions. */
  kind?: string;
}

export async function fetchTranscript(videoId: string): Promise<string> {
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
  if (playability?.status && playability.status !== "OK") {
    // LOGIN_REQUIRED here usually means YouTube is bot-checking the server's
    // IP, not that the video is private — say both, since we can't tell.
    throw new TranscriptError(
      playability.status === "LOGIN_REQUIRED"
        ? "YouTube asked the server to sign in (private video, or YouTube is blocking the server)."
        : `YouTube says this video is unavailable${playability.reason ? `: ${playability.reason}` : "."}`,
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
