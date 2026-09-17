"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV, NAV_FRAME_H, frameScale, lerp, viewportT } from "@/lib/layout";
import { TYPEFORM_URL } from "@/lib/links";
import {
  APPLICATIONS_CLOSED_LABEL, CLOSED_NAV_FONT_SIZE, CLOSED_NAV_WIDTH, CLOSED_OPACITY, closedNavSpace,
} from "@/lib/applications";
import { useApplicationsClosed } from "@/lib/use-applications-closed";

/**
 * Nav strip used by non-homepage pages. Renders at the same screen position,
 * size, and style as the homepage Canvas's inline nav so that switching
 * between pages does not visually shift any nav item.
 */
export default function FluidNav() {
  const [vw, setVw] = useState<number | null>(null);
  // NB: not `closed` — that name silently resolves to the window.closed global.
  const appsClosed = useApplicationsClosed();

  useEffect(() => {
    const calc = () => setVw(window.innerWidth);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  if (vw === null) {
    // Reserve space so the page doesn't jump when JS hydrates.
    return <div style={{ height: NAV_FRAME_H, background: "#fff" }} />;
  }

  const t = viewportT(vw);
  const { frameW, scale } = frameScale(vw, t);

  const logo = {
    x: lerp(NAV.logo.d.x, NAV.logo.m.x, t),
    y: lerp(NAV.logo.d.y, NAV.logo.m.y, t),
    w: lerp(NAV.logo.d.w, NAV.logo.m.w, t),
    h: lerp(NAV.logo.d.h, NAV.logo.m.h, t),
  };
  const adobe = {
    x: lerp(NAV.adobe.d.x, NAV.adobe.m.x, t),
    y: lerp(NAV.adobe.d.y, NAV.adobe.m.y, t),
    w: lerp(NAV.adobe.d.w, NAV.adobe.m.w, t),
    h: lerp(NAV.adobe.d.h, NAV.adobe.m.h, t),
  };
  // Room for the closed label beside the View Submissions link (frame coords).
  const navSpace = closedNavSpace(
    lerp(NAV.applyNav.d.x, NAV.applyNav.m.x, t),
    lerp(NAV.applyNav.d.w, NAV.applyNav.m.w, t),
    NAV.viewNav.d.x,
  );
  const view = {
    x: NAV.viewNav.d.x,
    y: lerp(NAV.viewNav.d.y, NAV.viewNav.m.y, t),
    fs: NAV.viewNav.d.fs,
    // Once closed, the wider label needs this link's space at narrow widths,
    // where it is already fading out anyway.
    opacity: appsClosed && navSpace < CLOSED_NAV_WIDTH ? 0 : Math.max(0, 1 - t * 2),
  };
  const apply = {
    x: lerp(NAV.applyNav.d.x, NAV.applyNav.m.x, t),
    y: lerp(NAV.applyNav.d.y, NAV.applyNav.m.y, t),
    w: lerp(NAV.applyNav.d.w, NAV.applyNav.m.w, t),
    h: lerp(NAV.applyNav.d.h, NAV.applyNav.m.h, t),
    fs: lerp(NAV.applyNav.d.fs, NAV.applyNav.m.fs, t),
  };

  return (
    // Transparent wrappers so the page's dot-grid background shows through under the nav,
    // matching how the homepage Canvas renders its dot grid behind everything.
    <div className="w-full flex justify-center overflow-hidden">
      <div style={{ width: frameW * scale, height: NAV_FRAME_H * scale }}>
        <div
          className="relative"
          style={{
            width: frameW,
            height: NAV_FRAME_H,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          <Link href="/" className="absolute" style={{ left: logo.x, top: logo.y, width: logo.w, height: logo.h }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.svg" alt="Creator Support" className="w-full h-full" />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/adobe-logo.png"
            alt="Adobe"
            className="absolute pointer-events-none"
            style={{ left: adobe.x, top: adobe.y, width: adobe.w, height: adobe.h, objectFit: "contain" }}
            draggable={false}
          />
          {view.opacity > 0.01 && (
            <Link
              href="/submissions"
              className="absolute font-semibold hover:opacity-70 whitespace-nowrap"
              style={{ left: view.x, top: view.y, fontSize: view.fs, lineHeight: 1, color: "#000", opacity: view.opacity }}
            >
              View Submissions
            </Link>
          )}
          {/* Apply — opens the Typeform in a new tab, same as on the homepage,
              and closes the same way: dimmed, relabelled, and no longer a link. */}
          <a
            href={appsClosed ? undefined : TYPEFORM_URL}
            target={appsClosed ? undefined : "_blank"}
            rel={appsClosed ? undefined : "noopener noreferrer"}
            aria-disabled={appsClosed || undefined}
            className={"absolute font-semibold flex items-center justify-center whitespace-nowrap" + (appsClosed ? " cursor-default" : " hover:opacity-70")}
            style={{
              // Closed: anchored by its right edge so the longer label grows
              // inwards instead of off the edge of the frame.
              ...(appsClosed
                ? { right: frameW - (apply.x + apply.w), padding: "0 8px" }
                : { left: apply.x, width: apply.w, paddingTop: 2 }),
              top: apply.y, height: apply.h,
              background: "#f6e921",
              fontSize: appsClosed ? CLOSED_NAV_FONT_SIZE : apply.fs, lineHeight: 1, color: "#000",
              opacity: appsClosed ? CLOSED_OPACITY : 1,
            }}
          >
            {appsClosed ? APPLICATIONS_CLOSED_LABEL : "Apply"}
          </a>
        </div>
      </div>
    </div>
  );
}
