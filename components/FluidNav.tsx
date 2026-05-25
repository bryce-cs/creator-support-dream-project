"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV, NAV_FRAME_H, frameScale, lerp, viewportT } from "@/lib/layout";

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
  const view = {
    x: NAV.viewNav.d.x,
    y: lerp(NAV.viewNav.d.y, NAV.viewNav.m.y, t),
    fs: NAV.viewNav.d.fs,
    opacity: Math.max(0, 1 - t * 2),
  };
  const apply = {
    x: lerp(NAV.applyNav.d.x, NAV.applyNav.m.x, t),
    y: lerp(NAV.applyNav.d.y, NAV.applyNav.m.y, t),
    w: lerp(NAV.applyNav.d.w, NAV.applyNav.m.w, t),
    h: lerp(NAV.applyNav.d.h, NAV.applyNav.m.h, t),
    fs: lerp(NAV.applyNav.d.fs, NAV.applyNav.m.fs, t),
  };

  return (
    <div className="w-full flex justify-center bg-white overflow-hidden">
      <div style={{ width: frameW * scale, height: NAV_FRAME_H * scale }}>
        <div
          className="relative bg-white"
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
          <Link
            href="#"
            className="absolute font-semibold hover:opacity-70 flex justify-center"
            style={{
              left: apply.x, top: apply.y, width: apply.w, height: apply.h,
              background: "#f6e921",
              fontSize: apply.fs, lineHeight: 1, color: "#000",
              paddingTop: 2,
            }}
          >
            Apply
          </Link>
        </div>
      </div>
    </div>
  );
}
