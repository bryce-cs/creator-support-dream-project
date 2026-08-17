// Pull submissions from the Typeform Responses API.
// Requires TYPEFORM_TOKEN env var (a Personal Access Token from Typeform).
// Falls back to an empty list on any failure so the page still renders.
// The field mapping itself lives in ./typeform-map so it can be tested offline.

import "server-only";
import type { Submission } from "./submissions";
import { normalizeUrl } from "./submissions";
import type { FieldMap, FormField, ResponseItem } from "./typeform-map";
import { flattenGroups, mapAnswers, publicFileUrl, resolveFields } from "./typeform-map";

const DEFAULT_FORM_ID = "MbmNRCNH";

interface ResponsesPayload {
  items?: ResponseItem[];
}

export async function fetchTypeformResponses(): Promise<Submission[]> {
  const token = process.env.TYPEFORM_TOKEN;
  const formId = process.env.TYPEFORM_FORM_ID || DEFAULT_FORM_ID;
  if (!token) return [];

  try {
    const [res, fields] = await Promise.all([
      fetch(
        `https://api.typeform.com/forms/${formId}/responses?page_size=200&completed=true`,
        {
          headers: { Authorization: `Bearer ${token}` },
          // Cache for 5 minutes; the page is also `force-dynamic` so a manual reload bypasses cache.
          next: { revalidate: 300 },
        },
      ),
      fetchFormFields(formId, token),
    ]);

    if (!res.ok) {
      console.error(`Typeform fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as ResponsesPayload;
    const items = data.items ?? [];
    const fieldMap = resolveFields(fields);
    // Map in parallel so YouTube oEmbed lookups happen concurrently.
    const submissions = await Promise.all(items.map((i) => toSubmission(i, fieldMap)));
    return submissions.filter((s): s is Submission => s !== null);
  } catch (err) {
    console.error("Typeform fetch error:", err);
    return [];
  }
}

/** Fetch the form definition's fields, in order. */
async function fetchFormFields(formId: string, token: string): Promise<FormField[]> {
  try {
    const res = await fetch(`https://api.typeform.com/forms/${formId}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`Typeform form fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = (await res.json()) as { fields?: FormField[] };
    return flattenGroups(data.fields ?? []).filter((f) => f.id && f.type !== "statement");
  } catch (err) {
    console.error("Typeform form fetch error:", err);
    return [];
  }
}

/** Map a response into a Submission, filling in the title from YouTube if the form didn't. */
async function toSubmission(item: ResponseItem, fields: FieldMap): Promise<Submission | null> {
  const mapped = mapAnswers(item, fields);
  if (!mapped) return null;

  // Only hit YouTube when the form didn't supply a title. oEmbed works for unlisted videos.
  const title = mapped.title || (await fetchYouTubeTitle(mapped.url)) || "";

  return {
    id: item.response_id,
    title: title || "Untitled",
    name: mapped.name || "Anonymous",
    youtube_url: mapped.url,
    submitted_at: item.submitted_at,
    likes: 0,
    ...(mapped.profileUrl ? { profile_url: normalizeUrl(mapped.profileUrl) } : {}),
    ...(mapped.thumbnail ? { thumbnail_url: publicFileUrl(mapped.thumbnail) } : {}),
  };
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
