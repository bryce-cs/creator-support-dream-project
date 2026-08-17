// Pure mapping between a Typeform form definition / response and the fields a
// submission card needs. No fetching and no server-only imports, so this can be
// exercised directly (see scripts/check-typeform-map.mjs).

import { normalizeUrl, extractYoutubeId } from "./submissions";

export type ContactInfo = {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  email?: string;
  company?: string;
};

export type Answer = {
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

export type ResponseItem = {
  response_id: string;
  submitted_at: string;
  answers?: Answer[];
};

export type FormField = {
  id?: string;
  ref?: string;
  type?: string;
  title?: string;
  subfield_key?: string;
  properties?: { fields?: FormField[] };
};

/** Field ids resolved from the form definition, one per thing the card needs. */
export type FieldMap = {
  name?: string;
  /** contact_info answers arrive one per subfield, so its parts need their own ids. */
  nameFirst?: string;
  nameLast?: string;
  profile?: string;
  title?: string;
  thumbnail?: string;
  video?: string;
};

/** Everything read off a single response, before the YouTube title fallback. */
export type MappedAnswers = {
  url: string;
  title: string;
  name: string;
  profileUrl: string;
  thumbnail: string;
};

/**
 * Only `group` fields are flattened. Composite fields such as contact_info keep
 * their nested first/last/email subfields tucked inside — they're one question
 * and one field, so hoisting them would shift every field after them.
 */
export function flattenGroups(fields: FormField[]): FormField[] {
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
export function resolveFields(fields: FormField[]): FieldMap {
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

  // A contact_info block answers as one response per subfield, each carrying the
  // subfield's own id — so grab the first/last ids rather than the block's.
  const subfields = fields.find((f) => f.id === map.name)?.properties?.fields ?? [];
  const subfield = (key: string, titleRe: RegExp) =>
    subfields.find((f) => f.subfield_key === key)?.id ||
    subfields.find((f) => titleRe.test(f.title || ""))?.id;
  map.nameFirst = subfield("first_name", /^first name$/i);
  map.nameLast = subfield("last_name", /^last name$/i);

  return map;
}

/**
 * Read one response using the resolved field ids. If the form definition
 * couldn't be fetched, falls back to inspecting answer types (a file upload is
 * the thumbnail, a link that parses as a video id is the pitch, etc.).
 *
 * Returns null when there's no usable video link — nothing to show without one.
 */
export function mapAnswers(item: ResponseItem, fields: FieldMap): MappedAnswers | null {
  const answers = item.answers ?? [];
  const byId = (id?: string): Answer | undefined =>
    id ? answers.find((a) => a.field?.id === id) : undefined;

  let url = pickText(byId(fields.video));
  let profileUrl = pickText(byId(fields.profile));
  let thumbnail = pickText(byId(fields.thumbnail));
  const title = pickText(byId(fields.title));
  const name = extractName(byId, fields, answers);

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
    profileUrl =
      answers.map((a) => a.url || "").find((l) => l && l !== url && !extractYoutubeId(l)) || "";
  }

  return { url, title, name, profileUrl, thumbnail };
}

/**
 * Build "First Last" from a contact_info block. Typeform returns one answer per
 * subfield (first name, last name, email) rather than a single grouped answer,
 * so read those ids first; the grouped shape is handled as a fallback.
 *
 * Note both name subfields are optional on the form, so a blank last name just
 * yields the first name.
 */
function extractName(
  byId: (id?: string) => Answer | undefined,
  fields: FieldMap,
  all: Answer[],
): string {
  const parts = [byId(fields.nameFirst), byId(fields.nameLast)]
    .map((a) => pickText(a).trim())
    .filter(Boolean);
  if (parts.length) return parts.join(" ");

  const contact = byId(fields.name)?.contact_info || all.find((a) => a.contact_info)?.contact_info;
  if (contact) {
    const grouped = [contact.first_name, contact.last_name]
      .map((p) => (p || "").trim())
      .filter(Boolean);
    if (grouped.length) return grouped.join(" ");
  }

  // Last resort: a subfield answer matched on its question title.
  const sub = (re: RegExp) => (all.find((a) => re.test(a.field?.title || ""))?.text || "").trim();
  return [sub(/^first name$/i), sub(/^last name$/i)].filter(Boolean).join(" ");
}

/**
 * Typeform-hosted uploads require the API token to read, so route those through
 * our own proxy. Anything else (a pasted image link) is used as-is.
 */
export function publicFileUrl(raw: string): string {
  const url = normalizeUrl(raw);
  if (/^https:\/\/api\.typeform\.com\//i.test(url)) {
    return `/api/typeform-file?u=${encodeURIComponent(url)}`;
  }
  return url;
}

export function pickText(a: Answer | undefined): string {
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
