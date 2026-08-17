// Pull submissions from the Typeform Responses API.
// Requires TYPEFORM_TOKEN env var (a Personal Access Token from Typeform).
// Falls back to an empty list on any failure so the page still renders.

import "server-only";
import type { Submission } from "./submissions";
import { normalizeUrl } from "./submissions";

const DEFAULT_FORM_ID = "MbmNRCNH";

// Question positions in the form (1-indexed, statements excluded).
const Q_PROFILE = 3; // link to their channel / profile
const Q_TITLE = 5; // idea title
const Q_THUMBNAIL = 6; // thumbnail image

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
  file_url?: string;
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

type FormField = {
  id?: string;
  ref?: string;
  type?: string;
  properties?: { fields?: FormField[] };
};

export async function fetchTypeformResponses(): Promise<Submission[]> {
  const token = process.env.TYPEFORM_TOKEN;
  const formId = process.env.TYPEFORM_FORM_ID || DEFAULT_FORM_ID;
  if (!token) return [];

  try {
    const [res, questionIds] = await Promise.all([
      fetch(
        `https://api.typeform.com/forms/${formId}/responses?page_size=200&completed=true`,
        {
          headers: { Authorization: `Bearer ${token}` },
          // Cache for 5 minutes; the page is also `force-dynamic` so a manual reload bypasses cache.
          next: { revalidate: 300 },
        },
      ),
      fetchQuestionFieldIds(formId, token),
    ]);

    if (!res.ok) {
      console.error(`Typeform fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as ResponsesPayload;
    const items = data.items ?? [];
    // Map in parallel so YouTube oEmbed lookups happen concurrently.
    const submissions = await Promise.all(items.map((i) => mapResponse(i, questionIds)));
    return submissions.filter((s): s is Submission => s !== null);
  } catch (err) {
    console.error("Typeform fetch error:", err);
    return [];
  }
}

/**
 * Fetch the form definition and return the field ids of its questions in order,
 * so answers can be looked up by question number. Statements are skipped (they
 * aren't numbered questions) and group fields are flattened.
 */
async function fetchQuestionFieldIds(formId: string, token: string): Promise<string[]> {
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
    return flattenFields(data.fields ?? [])
      .filter((f) => f.id && f.type !== "statement")
      .map((f) => f.id as string);
  } catch (err) {
    console.error("Typeform form fetch error:", err);
    return [];
  }
}

function flattenFields(fields: FormField[]): FormField[] {
  const out: FormField[] = [];
  for (const f of fields) {
    const nested = f.properties?.fields;
    if (nested && nested.length) {
      out.push(...flattenFields(nested));
    } else {
      out.push(f);
    }
  }
  return out;
}

/**
 * Map a Typeform response into a Submission.
 *
 * Questions are located by position in the form (see Q_* constants above), with
 * field `ref`s taking precedence when they're set on the Typeform side:
 *  - ref `youtube_url` (or `url`) -> youtube_url
 *  - ref `name` -> name. Handles the contact_info field type by combining first_name + last_name.
 *  - ref `title` (or `idea`) -> idea title
 *  - ref `profile_url` (or `channel`) -> creator's channel/profile link
 *  - ref `thumbnail` -> thumbnail image
 *
 * If no title answer is present, the YouTube video title is fetched via oEmbed.
 */
async function mapResponse(item: ResponseItem, questionIds: string[]): Promise<Submission | null> {
  const answers = item.answers ?? [];

  const byQuestion = (n: number): Answer | undefined => {
    const id = questionIds[n - 1];
    if (!id) return undefined;
    return answers.find((a) => a.field?.id === id);
  };

  let url = "";
  let name = "";
  let title = "";
  let profileUrl = "";
  let thumbnail = "";

  for (const a of answers) {
    const ref = (a.field?.ref || "").toLowerCase();
    if (!url && (ref === "url" || ref === "youtube_url" || ref === "youtube")) {
      url = a.url || a.text || "";
    } else if (!name && ref === "name") {
      name = extractName(a);
    } else if (!title && (ref === "title" || ref === "idea" || ref === "idea_title")) {
      title = pickText(a);
    } else if (!profileUrl && (ref === "profile_url" || ref === "profile" || ref === "channel")) {
      profileUrl = pickText(a);
    } else if (!thumbnail && (ref === "thumbnail" || ref === "thumbnail_url" || ref === "image")) {
      thumbnail = pickText(a);
    }
  }

  // Positional lookups for anything the refs didn't cover.
  if (!title) title = pickText(byQuestion(Q_TITLE));
  if (!profileUrl) profileUrl = pickText(byQuestion(Q_PROFILE));
  if (!thumbnail) thumbnail = pickText(byQuestion(Q_THUMBNAIL));

  if (!url) {
    // Prefer an answer that actually looks like a YouTube link, then any other
    // link that isn't the profile or thumbnail answer.
    const links = answers.map((a) => a.url || "").filter(Boolean);
    url =
      links.find((l) => /(?:youtube\.com|youtu\.be)/i.test(l)) ||
      links.find((l) => l !== profileUrl && l !== thumbnail) ||
      "";
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
        return t && t !== url && t !== title && t !== profileUrl;
      });
      name = text ? pickText(text) : "";
    }
  }

  // Only hit YouTube when the form didn't supply a title. oEmbed works for unlisted videos.
  if (!title) title = (await fetchYouTubeTitle(url)) || "";

  return {
    id: item.response_id,
    title: title || "Untitled",
    name: name || "Anonymous",
    youtube_url: url,
    submitted_at: item.submitted_at,
    likes: 0,
    ...(profileUrl ? { profile_url: normalizeUrl(profileUrl) } : {}),
    ...(thumbnail ? { thumbnail_url: publicFileUrl(thumbnail) } : {}),
  };
}

/**
 * Typeform-hosted uploads require the API token to read, so route those through
 * our own proxy. Anything else (a pasted image link) is used as-is.
 */
function publicFileUrl(raw: string): string {
  const url = normalizeUrl(raw);
  if (/^https:\/\/api\.typeform\.com\//i.test(url)) {
    return `/api/typeform-file?u=${encodeURIComponent(url)}`;
  }
  return url;
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

function pickText(a: Answer | undefined): string {
  if (!a) return "";
  return (
    a.text ||
    a.file_url ||
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
