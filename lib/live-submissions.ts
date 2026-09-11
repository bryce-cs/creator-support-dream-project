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
  /** Filled in by the admin "Check subscriber counts" action. */
  youtube?: YouTubeStats;
  /** Which lists an admin has ticked this person onto. Absent = none. */
  picks?: Partial<Record<PickList, true>>;
}

/**
 * The per-row checkboxes in /admin, in column order. Adding a list is one
 * entry here plus a label; storage, filtering, saving and the CSV follow.
 *
 * "live" was once the single "shortlist" box and was stored as
 * `shortlisted: true` — readLiveSubmissions converts that on the way in.
 */
export const PICK_LISTS = ["live", "show"] as const;
export type PickList = (typeof PICK_LISTS)[number];
export const PICK_LABELS: Record<PickList, string> = { live: "Live", show: "Show" };

export function isPicked(r: LiveSubmission, list: PickList): boolean {
  return Boolean(r.picks?.[list]);
}

export interface YouTubeStats {
  checkedAt: string;
  status: "ok" | "not-youtube" | "not-found" | "error";
  /** null when the channel hides its count. */
  subscribers?: number | null;
  title?: string;
  channelId?: string;
  /** Resolved by free-text search, so it may be the wrong channel. */
  matchedBySearch?: boolean;
  error?: string;
}

/** Rows have no id; arrival time plus email is unique in practice. */
export function rowKey(r: Pick<LiveSubmission, "at" | "email">): string {
  return `${r.at}|${r.email}`;
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 1234 → "1.2K", 1500000 → "1.5M". */
export function formatSubscribers(n: number): string {
  return compact.format(n);
}

// ─── Sorting and filtering for the admin table ───

export type SortKey = "at" | "subscribers";
export type SortDir = "asc" | "desc";
export interface View {
  sort: { key: SortKey; dir: SortDir };
  /** Inclusive bounds; null means unbounded on that side. */
  min: number | null;
  max: number | null;
  /**
   * Only rows on at least one of these lists. Ticking both Live and Show shows
   * anyone on either — the usual meaning of two ticked values in one filter.
   */
  lists?: PickList[];
}

/** The first direction a column sorts in when you click it. */
export const FIRST_DIR: Record<SortKey, SortDir> = {
  at: "desc", // newest first, which is also the page's default
  subscribers: "asc", // lowest first
};

/** A row's subscriber count, or null if there isn't a usable one. */
export function subscriberCount(r: LiveSubmission): number | null {
  const y = r.youtube;
  return y?.status === "ok" && typeof y.subscribers === "number" ? y.subscribers : null;
}

/**
 * Parse a filter bound as typed: "50000", "50,000", "50k", "1.5M", "2b".
 * Empty means no bound (null); anything else unreadable is "invalid" so the
 * input can say so instead of silently filtering on a wrong number.
 */
export function parseSubscriberBound(input: string): number | null | "invalid" {
  const s = input.trim().toLowerCase().replace(/[,_\s]/g, "");
  if (s === "") return null;
  const m = s.match(/^(\d+(?:\.\d+)?|\.\d+)([kmb])?$/);
  if (!m) return "invalid";
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  return Math.round(Number(m[1]) * mult);
}

/**
 * Filter, then sort. Rows with no count (unchecked, hidden, not YouTube, not
 * found) can't be placed in a subscriber window, so any bound drops them; and
 * when sorting by subscribers they go last in BOTH directions — otherwise
 * "lowest first" would open with a page of blanks.
 */
export function applyView(rows: LiveSubmission[], view: View): LiveSubmission[] {
  const { min, max } = view;
  const bounded = min !== null || max !== null;
  const kept = rows.filter((r) => {
    if (view.lists?.length && !view.lists.some((l) => isPicked(r, l))) return false;
    if (!bounded) return true;
    const n = subscriberCount(r);
    return n !== null && (min === null || n >= min) && (max === null || n <= max);
  });

  const sign = view.sort.dir === "asc" ? 1 : -1;
  const byTime = (a: LiveSubmission, b: LiveSubmission) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : 0;

  if (view.sort.key === "at") return kept.sort((a, b) => sign * byTime(a, b));

  return kept.sort((a, b) => {
    const x = subscriberCount(a);
    const y = subscriberCount(b);
    if (x === null && y === null) return -byTime(a, b); // blanks: newest first
    if (x === null) return 1;
    if (y === null) return -1;
    return sign * (x - y) || -byTime(a, b); // ties: newest first
  });
}

const HEADERS = [
  "Submitted",
  "Email",
  "Channel",
  "Subscribers",
  "YouTube channel",
  "Biggest challenge",
  "Kit",
  ...PICK_LISTS.map((l) => PICK_LABELS[l]),
];

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
      [
        cell(r.at),
        cell(r.email),
        // Handles start with @, which some spreadsheets treat as a formula too.
        cell(defuse(r.channel)),
        // The exact number, not "1.2K": a spreadsheet should be able to sort it.
        cell(r.youtube?.subscribers != null ? String(r.youtube.subscribers) : ""),
        cell(defuse(r.youtube?.title ?? "")),
        cell(defuse(r.problem)),
        cell(r.kit),
        ...PICK_LISTS.map((l) => cell(isPicked(r, l) ? "yes" : "")),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** Stop a spreadsheet reading a leading =, +, - or @ as a formula. */
function defuse(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
