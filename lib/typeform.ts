// Pull submissions from the Typeform Responses API.
// Requires TYPEFORM_TOKEN env var (a Personal Access Token from Typeform).
// Falls back to an empty list on any failure so the page still renders.

import "server-only";
import type { Submission } from "./submissions";

const DEFAULT_FORM_ID = "MbmNRCNH";

type ContactInfo = {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  email?: string;
  company?: string;
};

type Answer = {
  field?: { id?: string; ref?: string; type?: string; title?: string };
  type?: string;
  text?: string;
  url?: string;
  email?: string;
  number?: number;
  choice?: { label?: string };
  contact_info?: ContactInfo;
};

type ResponseItem = {
  response_id: string;
  submitted_at: string;
  answers?: Answer[];
};

interface ResponsesPayload {
  items?: ResponseItem[];
}

export async function fetchTypeformResponses(): Promise<Submission[]> {
  const token = process.env.TYPEFORM_TOKEN;
  const formId = process.env.TYPEFORM_FORM_ID || DEFAULT_FORM_ID;
  if (!token) return [];

  try {
    const res = await fetch(
      `https://api.typeform.com/forms/${formId}/responses?page_size=200&completed=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
        // Cache for 5 minutes; the page is also `force-dynamic` so a manual reload bypasses cache.
        next: { revalidate: 300 },
      },
    );

    if (!res.ok) {
      console.error(`Typeform fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as ResponsesPayload;
    const items = data.items ?? [];
    // Map in parallel so YouTube oEmbed lookups happen concurrently.
    const submissions = await Promise.all(items.map(mapResponse));
    return submissions.filter((s): s is Submission => s !== null);
  } catch (err) {
    console.error("Typeform fetch error:", err);
    return [];
  }
}

/**
 * Map a Typeform response into a Submission.
 *
 * Field detection prefers field `ref`s set on the Typeform side:
 *  - ref `youtube_url` (or `url`) -> youtube_url
 *  - ref `name` -> name. Handles the contact_info field type by combining first_name + last_name.
 *  - ref `title` (or `idea`) -> fallback title if YouTube oEmbed lookup fails.
 *
 * The displayed idea title is fetched from YouTube via oEmbed using the youtube_url.
 */
async function mapResponse(item: ResponseItem): Promise<Submission | null> {
  const answers = item.answers ?? [];
  let url = "";
  let name = "";
  let titleFallback = "";

  for (const a of answers) {
    const ref = (a.field?.ref || "").toLowerCase();
    if (!url && (ref === "url" || ref === "youtube_url" || ref === "youtube")) {
      url = a.url || a.text || "";
    } else if (!name && ref === "name") {
      name = extractName(a);
    } else if (!titleFallback && (ref === "title" || ref === "idea" || ref === "idea_title")) {
      titleFallback = pickText(a);
    }
  }

  // Generic fallbacks if refs weren't set.
  if (!url) {
    for (const a of answers) {
      if (a.url) { url = a.url; break; }
    }
  }
  if (!url) return null;

  if (!name) {
    // Find any contact_info answer, or fall back to the first plain text.
    const contact = answers.find((a) => a.contact_info);
    if (contact) {
      name = extractName(contact);
    } else {
      const text = answers.find((a) => {
        const t = pickText(a);
        return t && t !== url && t !== titleFallback;
      });
      name = text ? pickText(text) : "";
    }
  }

  // Pull the YouTube video title via oEmbed. This works for unlisted videos.
  const ytTitle = await fetchYouTubeTitle(url);
  const title = ytTitle || titleFallback || "Untitled";

  return {
    id: item.response_id,
    title,
    name: name || "Anonymous",
    youtube_url: url,
    submitted_at: item.submitted_at,
    likes: 0,
  };
}

function extractName(a: Answer): string {
  if (a.contact_info) {
    const parts = [a.contact_info.first_name, a.contact_info.last_name]
      .map((p) => (p || "").trim())
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  return pickText(a);
}

function pickText(a: Answer): string {
  return (
    a.text ||
    a.url ||
    a.email ||
    a.choice?.label ||
    (typeof a.number === "number" ? String(a.number) : "") ||
    ""
  );
}

/**
 * Fetch a YouTube video's title via the public oEmbed endpoint.
 * Works for public and unlisted videos without an API key. Cached for 24h.
 */
async function fetchYouTubeTitle(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title?.trim() || null;
  } catch {
    return null;
  }
}
