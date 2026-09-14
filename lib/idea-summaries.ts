// Client-safe types for idea submission summaries. No node imports.

export interface IdeaSummary {
  text: string;
  /** "ai" until someone edits it by hand; a hand edit is never overwritten by a bulk run. */
  source: "ai" | "edited";
  /** ISO timestamp of the last generate or save. */
  at: string;
}

/** Keyed by submission id (the Typeform response_id). */
export type IdeaSummaries = Record<string, IdeaSummary>;

/** Longest summary a hand edit may save. Far above 2-3 sentences. */
export const SUMMARY_MAX = 2000;
