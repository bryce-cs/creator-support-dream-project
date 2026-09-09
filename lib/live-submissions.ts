// Channel submissions from /live, kept as our own copy.
//
// Kit is the system of record for the mailing list, but it's a third party we
// don't control: a bad key, a renamed custom field, or an outage all produce
// submissions that are gone for good. So every submission is written here too,
// whatever Kit says, and the admin page reads from this file rather than from
// Kit's API — the point is to still have the list on a day Kit is the problem.
//
// Pure types and formatting, no node imports, so the admin UI can use them.

export interface LiveSubmission {
  /** ISO timestamp, assigned server-side on arrival. */
  at: string;
  email: string;
  channel: string;
  problem: string;
  /** What Kit did with it, so a broken stretch is visible at a glance. */
  kit: "ok" | "failed" | "not-configured";
}

const HEADERS = ["Submitted", "Email", "Channel", "Biggest challenge", "Kit"] as const;

/** Escape one CSV cell: quote it, and double any quotes inside. */
function cell(value: string): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Spreadsheet export of the whole list. Newest first, matching the admin table.
 *
 * A leading apostrophe would be needed to stop Excel treating a value starting
 * with = as a formula, but every field here is either a date, an email, a URL
 * or free text, and all of them are quoted — so the only real risk is a
 * "biggest challenge" answer beginning with =, which we neutralise below.
 */
export function toCsv(rows: LiveSubmission[]): string {
  const lines = [HEADERS.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [cell(r.at), cell(r.email), cell(r.channel), cell(defuse(r.problem)), cell(r.kit)].join(","),
    );
  }
  return lines.join("\n");
}

/** Stop a spreadsheet reading a leading =, +, - or @ as a formula. */
function defuse(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
