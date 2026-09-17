"use client";

import { useEffect, useState } from "react";
import { APPLICATIONS_CLOSE_AT, applicationsClosed } from "./applications";

/**
 * Whether applications are closed, for the client components that draw the
 * Apply buttons.
 *
 * The first render uses the same clock the server did, so hydration matches.
 * A tab left open across the cutoff flips on its own instead of showing a live
 * Apply button until someone reloads.
 */
export function useApplicationsClosed(): boolean {
  const [closed, setClosed] = useState(applicationsClosed);

  useEffect(() => {
    if (closed) return;
    const ms = Date.parse(APPLICATIONS_CLOSE_AT) - Date.now();
    // setTimeout caps out around 24.8 days; re-check instead of firing late.
    const id = setTimeout(() => setClosed(applicationsClosed()), Math.min(Math.max(ms, 0), 21_600_000));
    return () => clearTimeout(id);
  }, [closed]);

  return closed;
}
