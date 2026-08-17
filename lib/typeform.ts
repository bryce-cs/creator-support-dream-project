// Pull submissions from the Typeform Responses API.
// Requires TYPEFORM_TOKEN env var (a Personal Access Token from Typeform).
// Falls back to an empty list on any failure so the page still renders.

import "server-only";
import type { Submission } from "./submissions";
import { normalizeUrl, extractYoutubeId } from "./submissions";

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
  title?: string;
  properties?: { fields?: FormField[] };
};

/** Field ids resolved from the form definition, one per thing the card needs. */
type FieldMap = {
  name?: string;
  profile?: string;
  title?: string;
  thumbnail?: string;
  video?: string;
};

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
    const submissions = await Promise.all(items.map((i) => mapResponse(i, fieldMap)));
    return submissions.filter((s): s is Submission => s !== null);
  } catch (err) {
    console.error("Typeform fetch error:", err);
    return [];
  }
}

/**
 * Fetch the form definition's fields, in order.
 *
 * Only `group` fields are flattened. Composite fields such as contact_info keep
 * their nested first/last/email subfields tucked inside — they're one question
 * and answer as one, so hoisting them would shift every field after them.
 */
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

function flattenGroups(fields: FormField[]): FormField[] {
  const out: FormField[] = [];
  for (const f of fields) {
    if (f.type === "group" && f.properties?.fields?.length) {
      out.push(...flattenGroups(f.properties.fields));
    } else {
      out.push(f);
    }
  }
  return out;
}

/**
 * Work out which field answers which part of a submission card, by field type
 * and question wording rather than position — so reordering or inserting a
 * question in Typeform doesn't silently shuffle the mapping. Custom refs set on
 * the Typeform side (e.g. `youtube_url`) win over the wording checks.
 *
 * As of writing the form reads:
 *   Q1 contact_info "Tell us about yourself."                    -> name
 *   Q3 website      "Add the link to your main channel..."       -> profile
 *   Q5 short_text   "Mockup a title and thumbnail... title here" -> title
 *   Q6 file_upload  "Upload the thumbnail here."                 -> thumbnail
 *   Q7 website      "Drop an unlisted YouTube link..."           -> video
 */
function resolveFields(fields: FormField[]): FieldMap {
  const map: FieldMap = {};
  const claimed = new Set<string>();

  const claim = (key: keyof FieldMap, tests: Array<(f: FormField) => boolean>) => {
    for (const test of tests) {
      const hit = fields.find((f) => f.id && !claimed.has(f.id) && test(f));
      if (hit?.id) {
        map[key] = hit.id;
        claimed.add(hit.id);
        return;
      }
    }
  };

  const ref = (f: FormField) => (f.ref || "").toLowerCase();
  const title = (f: FormField) => f.title || "";

  // Video first: it's the one field that must be right, and its wording overlaps
  // with the profile question (both are links, both may mention YouTube).
  claim("video", [
    (f) => ["youtube_url", "youtube", "video_url", "url"].includes(ref(f)),
    (f) => /unlisted/i.test(title(f)),
    (f) => /(youtube|video).*(link|url)|(link|url).*(youtube|video)/i.test(title(f)),
  ]);
  claim("profile", [
    (f) => ["profile_url", "profile", "channel"].includes(ref(f)),
    (f) => /channel or profile/i.test(title(f)),
    (f) => f.type === "website" && /channel|profile|handle/i.test(title(f)),
  ]);
  claim("title", [
    (f) => ["title", "idea_title", "idea"].includes(ref(f)),
    (f) => /add the title/i.test(title(f)),
    (f) => f.type !== "file_upload" && /\btitles?\b/i.test(title(f)),
  ]);
  claim("thumbnail", [
    (f) => ["thumbnail", "thumbnail_url", "image"].includes(ref(f)),
    (f) => f.type === "file_upload",
    (f) => /thumbnail/i.test(title(f)),
  ]);
  claim("name", [
    (f) => f.type === "contact_info",
    (f) => ref(f) === "name",
    (f) => /your name|full name/i.test(title(f)),
  ]);

  return map;
}

/**
 * Map a Typeform response into a Submission, reading each answer by the field id
 * resolved from the form definition. If the definition couldn't be fetched, falls
 * back to inspecting answer types (a file upload is the thumbnail, a link that
 * parses as a video id is the pitch, etc.).
 *
 * If no title answer is present, the YouTube video title is fetched via oEmbed.
 */
async function mapResponse(item: ResponseItem, fields: FieldMap): Promise<Submission | null> {
  const answers = item.answers ?? [];
  const byId = (id?: string): Answer | undefined =>
    id ? answers.find((a) => a.field?.id === id) : undefined;

  let url = pickText(byId(fields.video));
  let title = pickText(byId(fields.title));
  let profileUrl = pickText(byId(fields.profile));
  let thumbnail = pickText(byId(fields.thumbnail));
  const name = extractName(byId(fields.name), answers);

  // Fallbacks for anything the form definition didn't resolve.
  if (!url) {
    const links = answers
      .filter((a) => a.field?.ref === "youtube_url" || a.url)
      .map((a) => a.url || a.text || "")
      .filter(Boolean);
    // A channel link like youtube.com/@handle is not a video, so require a real id.
    url = links.find((l) => extractYoutubeId(l)) || "";
  }
  if (!url) return null;

  if (!thumbnail) thumbnail = answers.find((a) => a.file_url)?.file_url || "";
  if (!profileUrl) {
    profileUrl = answers.map((a) => a.url || "").find((l) => l && l !== url && !extractYoutubeId(l)) || "";
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

/**
 * Build "First Last" from a contact_info answer. Typeform usually returns the
 * block as a single answer, but can also return one answer per subfield, so
 * check both. Falls back to whatever single name-ish answer exists.
 */
function extractName(answer: Answer | undefined, all: Answer[]): string {
  const contact = answer?.contact_info ? answer : all.find((a) => a.contact_info);
  if (contact?.contact_info) {
    const parts = [contact.contact_info.first_name, contact.contact_info.last_name]
      .map((p) => (p || "").trim())
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  // Separate first/last answers, matched on the subfield's question title.
  const sub = (re: RegExp) =>
    (all.find((a) => re.test(a.field?.title || ""))?.text || "").trim();
  const first = sub(/^first name$/i);
  const last = sub(/^last name$/i);
  if (first || last) return [first, last].filter(Boolean).join(" ");

  return pickText(answer);
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
