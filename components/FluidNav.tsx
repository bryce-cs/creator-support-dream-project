"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV, NAV_FRAME_H, WINNER_NAV_W, frameScale, lerp, viewportT } from "@/lib/layout";

/**
 * Nav strip used by non-homepage pages. Renders at the same screen position,
 * size, and style as the homepage Canvas's inline nav so that switching
 * between pages does not visually shift any nav item.
 */
export default function FluidNav() {
  const [vw, setVw] = useState<number | null>(null);

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
  const winner = {
    x: lerp(NAV.winnerNav.d.x, NAV.winnerNav.m.x, t),
    y: lerp(NAV.winnerNav.d.y, NAV.winnerNav.m.y, t),
    fs: lerp(NAV.winnerNav.d.fs, NAV.winnerNav.m.fs, t),
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
          {/* Winner Announced — on the homepage this scrolls; from here it goes
              home and lands on the same block. */}
          <Link
            href="/#winner"
            className="absolute hover:opacity-70 whitespace-nowrap"
            style={{
              right: frameW - (winner.x + WINNER_NAV_W),
              top: winner.y, fontSize: winner.fs, lineHeight: 1, color: "#000",
            }}
          >
            Winner Announced
          </Link>
        </div>
      </div>
    </div>
  );
}
