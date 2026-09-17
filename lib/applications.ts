// When entries stop being accepted.
//
// The cutoff is baked in rather than flipped by hand or by a scheduled job, so
// the site closes itself at the right moment even if nobody is around and
// nothing is deployed that night. Pages that show an Apply button render
// dynamically (see `dynamic = "force-dynamic"`), so the first request after the
// cutoff already gets the closed state.

/** Midnight Pacific on Sep 18 2026 (PDT is UTC-7), i.e. the end of Sep 17. */
export const APPLICATIONS_CLOSE_AT = "2026-09-18T07:00:00Z";

/** What an Apply button says once applications are closed. */
export const APPLICATIONS_CLOSED_LABEL = "Applications closed";

/** How much a closed button is dimmed. */
export const CLOSED_OPACITY = 0.45;

export function applicationsClosed(now: number = Date.now()): boolean {
  return now >= Date.parse(APPLICATIONS_CLOSE_AT);
}

/**
 * Font size for the closed label inside a button built for the word "Apply".
 * "Applications closed" is far longer, so it shrinks to fit rather than
 * spilling out of the yellow box. Never grows past the button's own size.
 */
export function closedFontSize(width: number, normal: number): number {
  const fits = (width - 24) / (APPLICATIONS_CLOSED_LABEL.length * 0.5);
  return Math.max(11, Math.min(normal, fits));
}

// ---- Nav sizing for the closed label ----------------------------------------
// The nav's Apply box is built for one short word, so the closed label is set
// smaller and anchored to the box's right edge. Measured, not guessed: at the
// desktop frame width "View Submissions" is ~155px wide at its 20px size, and
// the label below is ~127px wide at 12px.

/** Font size of the closed label in the nav. */
export const CLOSED_NAV_FONT_SIZE = 12;
/** Width the closed label needs there, padding included. */
export const CLOSED_NAV_WIDTH = 130;
/** Width of the "View Submissions" nav link it has to sit beside. */
export const VIEW_LINK_WIDTH = 155;

/**
 * Room left for the closed label between the View Submissions link and the
 * right edge of the Apply box, in frame coordinates. Below CLOSED_NAV_WIDTH the
 * two would overlap, so the nav link is dropped — it is already fading out at
 * those widths, and the same link sits in the page body.
 */
export function closedNavSpace(applyX: number, applyW: number, viewX: number): number {
  return applyX + applyW - (viewX + VIEW_LINK_WIDTH) - 12;
}
