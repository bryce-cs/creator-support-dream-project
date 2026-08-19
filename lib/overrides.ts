// Admin display overrides.
//
// Submissions keep flowing in from Typeform automatically. An override changes
// only how one card *renders* on the site — the Typeform response is never
// touched, and any field the admin hasn't edited keeps tracking Typeform.
//
// Pure types and merge logic, no node imports, so both the admin UI and the
// offline check script can use this.

import type { Submission } from "./submissions";

/** Card fields an admin can override. Everything else still comes from Typeform. */
export const OVERRIDABLE_FIELDS = [
  "title",
  "name",
  "thumbnail_url",
  "profile_url",
  "youtube_url",
] as const;

export type OverridableField = (typeof OVERRIDABLE_FIELDS)[number];

export type Override = Partial<Record<OverridableField, string>> & { hidden?: boolean };

/** Keyed by submission id, which is the Typeform response_id. */
export type Overrides = Record<string, Override>;

/**
 * Merge an override into a submission.
 *
 * Presence is what counts: a key that exists wins even when its value is an
 * empty string, which is how the admin clears a bad profile link. A key that is
 * absent falls through to Typeform, so untouched fields stay automatic.
 */
export function applyOverride(submission: Submission, override?: Override): Submission {
  if (!override) return submission;
  const merged: Submission = { ...submission };

  for (const field of OVERRIDABLE_FIELDS) {
    const value = override[field];
    if (typeof value !== "string") continue;
    if (field === "title" || field === "name" || field === "youtube_url") {
      // Required on the card — an empty override would blank it out, so ignore.
      if (value.trim()) merged[field] = value.trim();
    } else if (value.trim()) {
      merged[field] = value.trim();
    } else {
      delete merged[field];
    }
  }

  if (override.hidden) {
    merged.hidden = true;
    merged.hidden_reason = "admin";
  }
  return merged;
}

export function applyOverrides(submissions: Submission[], overrides: Overrides): Submission[] {
  return submissions.map((s) => applyOverride(s, overrides[s.id]));
}

/**
 * What an admin actually changed, relative to the values Typeform supplies.
 *
 * Storing only the differences is what keeps the rest of the card automatic: if
 * someone fixes a title today and Typeform's thumbnail changes tomorrow, the new
 * thumbnail still comes through.
 */
export function diffOverride(base: Submission, edited: Override): Override {
  const out: Override = {};
  for (const field of OVERRIDABLE_FIELDS) {
    const next = edited[field];
    if (typeof next !== "string") continue;
    const trimmed = next.trim();
    const current = (base[field] ?? "").trim();
    if (trimmed !== current) out[field] = trimmed;
  }
  if (edited.hidden) out.hidden = true;
  return out;
}

/** True when an override carries nothing and can be dropped from storage. */
export function isEmptyOverride(o: Override): boolean {
  return Object.keys(o).length === 0;
}

/**
 * Coerce untrusted JSON into an Override. Anything unrecognised is discarded
 * rather than trusted, since this arrives from an HTTP request body.
 */
export function parseOverride(raw: unknown): Override {
  const out: Override = {};
  if (typeof raw !== "object" || raw === null) return out;
  const v = raw as Record<string, unknown>;
  for (const field of OVERRIDABLE_FIELDS) {
    const value = v[field];
    // Cap length so a pasted novel can't bloat the stored file.
    if (typeof value === "string") out[field] = value.slice(0, 2000);
  }
  if (v.hidden === true) out.hidden = true;
  return out;
}

/** Coerce untrusted JSON into an Overrides map. */
export function parseOverrides(raw: unknown): Overrides {
  const out: Overrides = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseOverride(value);
    if (!isEmptyOverride(parsed)) out[id] = parsed;
  }
  return out;
}
