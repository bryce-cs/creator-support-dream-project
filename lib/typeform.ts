// Pull submissions from the Typeform Responses API.
// Requires TYPEFORM_TOKEN env var (a Personal Access Token from Typeform).
// Falls back to an empty list on any failure so the page still renders.

import "server-only";
import type { Submission } from "./submissions";

const DEFAULT_FORM_ID = "MbmNRCNH";

type Answer = {
  field?: { id?: string; ref?: string; type?: string; title?: string };
  type?: string;
  text?: string;
  url?: string;
  email?: string;
  number?: number;
  choice?: { label?: string };
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
    return items
      .map(mapResponse)
      .filter((s): s is Submission => s !== null);
  } catch (err) {
    console.error("Typeform fetch error:", err);
    return [];
  }
}

/**
 * Map a Typeform response into a Submission.
 *
 * Field detection is heuristic so the form can evolve without code changes:
 *  - any answer with a URL becomes the youtube_url
 *  - the first text answer with "name" in its question title becomes the name,
 *    or otherwise the second text answer
 *  - the first text answer with "idea" or "title" in its question title becomes the title,
 *    or otherwise the first text answer
 *
 * To override, set field `ref`s in Typeform to `name`, `title`/`idea`, or `url`/`youtube_url`.
 */
function mapResponse(item: ResponseItem): Submission | null {
  const answers = item.answers ?? [];
  let url = "";
  let title = "";
  let name = "";

  // First pass: explicit field refs win.
  for (const a of answers) {
    const ref = (a.field?.ref || "").toLowerCase();
    const text = pickText(a);
    if (!url && (ref === "url" || ref === "youtube_url" || ref === "youtube") && (a.url || text)) {
      url = a.url || text;
    } else if (!title && (ref === "title" || ref === "idea" || ref === "idea_title")) {
      title = text;
    } else if (!name && ref === "name") {
      name = text;
    }
  }

  // Second pass: fall back to type heuristics.
  if (!url) {
    for (const a of answers) {
      if (a.url) { url = a.url; break; }
    }
  }
  if (!title || !name) {
    const textCandidates: { text: string; q: string }[] = [];
    for (const a of answers) {
      const t = pickText(a);
      if (!t) continue;
      // Skip the URL answer.
      if (t === url) continue;
      textCandidates.push({ text: t, q: (a.field?.title || "").toLowerCase() });
    }
    if (!title) {
      const ideaMatch = textCandidates.find((c) => /idea|title|project/.test(c.q));
      title = (ideaMatch || textCandidates[0])?.text || "";
    }
    if (!name) {
      const nameMatch = textCandidates.find((c) => /name/.test(c.q));
      name = (nameMatch || textCandidates.find((c) => c.text !== title))?.text || "";
    }
  }

  if (!url) return null;
  return {
    id: item.response_id,
    title: title || "Untitled",
    name: name || "Anonymous",
    youtube_url: url,
    submitted_at: item.submitted_at,
    likes: 0,
  };
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
