"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DESKTOP_W, MOBILE_W, LERP_MAX, LERP_MIN, lerp, viewportT, NAV, WINNER_NAV_W } from "@/lib/layout";
import WinnerSection, { SECTION } from "@/components/WinnerSection";

// Frame widths are shared via lib/layout. These heights are only a first-paint
// estimate: the real frame is the hero plus however tall the announcement column
// below it renders, which WinnerSection measures and hands back.
const DESKTOP = { w: DESKTOP_W, h: 3513 };
const MOBILE = { w: MOBILE_W, h: 3180 };
// Re-export for clarity in this file (positions used directly below).
void LERP_MAX; void LERP_MIN; void viewportT;

type Pos = { x: number; y: number; w: number; h: number };
type Kind = "img" | "svg" | "logo";

interface ItemConfig {
  id: string;
  kind: Kind;
  src?: string;
  alt?: string;
  imgStyle?: React.CSSProperties;
  d: Pos;            // desktop layout position
  m: Pos | null;     // mobile position; null = desktop-only (fades out)
}

const ITEMS: ItemConfig[] = [
  {
    id: "bryce", kind: "img", src: "/assets/bryce.webp", alt: "Bryce Andersen",
    imgStyle: { height: "155.62%", left: "-13.62%", top: "-17.76%", width: "155.6%", position: "absolute", maxWidth: "none" },
    d: { x: 363, y: 295, w: 423, h: 282 },
    m: { x: 26, y: 234, w: 245, h: 163 },
  },
  {
    id: "amanda", kind: "img", src: "/assets/amanda.webp", alt: "Amanda Rach Lee",
    imgStyle: { height: "124.62%", left: "-12.4%", top: "0.04%", width: "124.62%", position: "absolute", maxWidth: "none" },
    d: { x: 714, y: 498, w: 386, h: 257 },
    m: { x: 215, y: 393, w: 222, h: 148 },
  },
  {
    id: "james", kind: "img", src: "/assets/james.webp", alt: "James Seo",
    imgStyle: { height: "318.8%", left: "-113.98%", top: "-73.33%", width: "307.04%", position: "absolute", maxWidth: "none" },
    d: { x: 607, y: 519, w: 142, h: 205 },
    m: { x: 73, y: 395, w: 118, h: 170 },
  },
  {
    id: "live05", kind: "img", src: "/assets/live05.webp", alt: "Live photos",
    imgStyle: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, maxWidth: "none" },
    d: { x: 985, y: 243, w: 191, h: 286 },
    m: { x: 321, y: 245, w: 123, h: 184 },
  },
  {
    id: "live06", kind: "img", src: "/assets/live06.webp", alt: "Live photos",
    imgStyle: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, maxWidth: "none" },
    d: { x: 867, y: 325, w: 146, h: 220 },
    m: { x: 247, y: 256, w: 98, h: 147 },
  },
  {
    id: "colt", kind: "img", src: "/assets/colt.webp", alt: "Colt",
    imgStyle: { height: "100.17%", left: "-24.58%", top: "-0.08%", width: "135.83%", position: "absolute", maxWidth: "none" },
    d: { x: 382, y: 524, w: 182, h: 165 },
    m: { x: -15, y: 364, w: 115, h: 104 },
  },
  // Logo + tag use special components; positions still lerp
  { id: "logo", kind: "logo", d: { x: 653, y: 420, w: 133, h: 125 }, m: { x: 150, y: 342, w: 101, h: 95 } },
  // Vector markings
  { id: "v42", kind: "svg", src: "/assets/vector42.svg",
    d: { x: 763, y: 276, w: 38.5, h: 50 },
    m: { x: 264, y: 212, w: 25, h: 33 } },
  { id: "v44", kind: "svg", src: "/assets/vector44.svg",
    d: { x: 344, y: 296.5, w: 11, h: 38.5 },
    m: { x: 8, y: 234, w: 9, h: 31 } },
  { id: "v45", kind: "svg", src: "/assets/vector45.svg",
    d: { x: 1109, y: 539, w: 48.5, h: 56 },
    m: { x: 304, y: 582, w: 13, h: 15 } },
  // Desktop-only marking (fades out on mobile)
  { id: "v43", kind: "svg", src: "/assets/vector43.svg",
    d: { x: 655, y: 734, w: 99, h: 33.5 }, m: null },
  // Big asterisk near title — both layouts
  { id: "v46", kind: "svg", src: "/assets/vector46.svg",
    d: { x: 916, y: 128, w: 22.5, h: 32 }, m: { x: 331, y: 106, w: 22.5, h: 32 } },
  // The matching small asterisk that opens the announcement copy is no longer
  // here — it belongs to that paragraph now, and lives in WinnerSection so the
  // two stay together however the copy wraps.
  // Small chevron near "creators supporting" tag — both layouts
  { id: "v48", kind: "svg", src: "/assets/vector48.svg",
    d: { x: 262, y: 565, w: 6, h: 14.5 }, m: { x: 228, y: 559, w: 6, h: 14.5 } },
];

// Chrome (non-draggable) positions
const CHROME = {
  title:     { d: { x: 514,  y: 141, w: 413, fs: 50 }, m: { x: 42,  y: 124, w: 319, fs: 34 } },
  // "Powered by Adobe" — text + logo, sit just under the title.
  poweredText: { d: { x: 603, y: 208, w: 144, fs: 25 }, m: { x: 106, y: 172, w: 117, fs: 20 } },
  adobeLogo:   { d: { x: 743, y: 195, w: 94, h: 51 }, m: { x: 219, y: 160, w: 76, h: 41 } },
  tagBox:    { d: { x: 238,  y: 558, w: 122, h: 80 }, m: { x: 208, y: 553, w: 170, h: 55 } },
};

// Nav-related layout lives in lib/layout (NAV.logo, NAV.adobe, NAV.winnerNav)
// so FluidNav (used on other pages) can render at identical screen positions.

// =============================================================

export default function WinnerCanvas() {
  const [vw, setVw] = useState<number | null>(null);

  useEffect(() => {
    const calc = () => setVw(window.innerWidth);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  if (vw === null) return <div style={{ minHeight: "100vh", background: "#fff" }} />;

  // t = 0 (desktop) -> 1 (mobile)
  const t = Math.max(0, Math.min(1, (LERP_MAX - vw) / (LERP_MAX - LERP_MIN)));
  return <FluidCanvas vw={vw} t={t} />;
}

function FluidCanvas({ vw, t }: { vw: number; t: number }) {
  const frameW = lerp(DESKTOP.w, MOBILE.w, t);
  // How tall the announcement column below the hero actually rendered. Null until
  // it has been measured once, when the estimated frame height stands in.
  const [sectionH, setSectionH] = useState<number | null>(null);
  const sectionTop = lerp(SECTION.top.d, SECTION.top.m, t);
  const frameH = sectionH === null
    ? lerp(DESKTOP.h, MOBILE.h, t)
    : sectionTop + sectionH + lerp(SECTION.bottomPad.d, SECTION.bottomPad.m, t);
  const scale = Math.min(1, vw / frameW);

  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // User drag offsets, applied on top of the lerped base position.
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [selectedId, setSelectedId] = useState<string | null>("james");

  const draggingRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startDx: number;
    startDy: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // One-time "stop-motion" load animation. Draggable items start spread out from
  // the cluster and snap inward. We advance a step counter at ~7fps and apply the
  // position with NO CSS transition, so the motion reads as posterized / stop-motion
  // rather than a smooth tween. animP: 0 = fully spread, 1 = landed in place.
  const [animP, setAnimP] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setAnimP(1);
      return;
    }
    const STEPS = 9;      // total discrete frames
    const STEP_MS = 140;  // ~7 fps
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setAnimP(step / STEPS);
      if (step >= STEPS) window.clearInterval(id);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  const onMove = useCallback((e: PointerEvent) => {
    const d = draggingRef.current;
    if (!d) return;
    const s = scaleRef.current || 1;
    const dx = (e.clientX - d.startClientX) / s;
    const dy = (e.clientY - d.startClientY) / s;
    setOffsets((prev) => ({
      ...prev,
      [d.id]: { dx: d.startDx + dx, dy: d.startDy + dy },
    }));
  }, []);

  const onUp = useCallback(() => {
    draggingRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging, onMove, onUp]);

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    const existing = offsets[id] ?? { dx: 0, dy: 0 };
    draggingRef.current = {
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startDx: existing.dx,
      startDy: existing.dy,
    };
    setIsDragging(true);
  };

  // Compute base lerped position for each item
  const itemPos = (cfg: ItemConfig) => {
    const d = cfg.d;
    const m = cfg.m ?? cfg.d; // fall back to desktop if mobile-less
    return {
      x: lerp(d.x, m.x, t),
      y: lerp(d.y, m.y, t),
      w: lerp(d.w, m.w, t),
      h: lerp(d.h, m.h, t),
    };
  };

  // Chrome lerps
  const title = {
    x: lerp(CHROME.title.d.x, CHROME.title.m.x, t),
    y: lerp(CHROME.title.d.y, CHROME.title.m.y, t),
    w: lerp(CHROME.title.d.w, CHROME.title.m.w, t),
    fs: lerp(CHROME.title.d.fs, CHROME.title.m.fs, t),
  };
  const navLogo = {
    x: lerp(NAV.logo.d.x, NAV.logo.m.x, t),
    y: lerp(NAV.logo.d.y, NAV.logo.m.y, t),
    w: lerp(NAV.logo.d.w, NAV.logo.m.w, t),
    h: lerp(NAV.logo.d.h, NAV.logo.m.h, t),
  };
  const navAdobeL = {
    x: lerp(NAV.adobe.d.x, NAV.adobe.m.x, t),
    y: lerp(NAV.adobe.d.y, NAV.adobe.m.y, t),
    w: lerp(NAV.adobe.d.w, NAV.adobe.m.w, t),
    h: lerp(NAV.adobe.d.h, NAV.adobe.m.h, t),
  };
  const poweredText = {
    x: lerp(CHROME.poweredText.d.x, CHROME.poweredText.m.x, t),
    y: lerp(CHROME.poweredText.d.y, CHROME.poweredText.m.y, t),
    w: lerp(CHROME.poweredText.d.w, CHROME.poweredText.m.w, t),
    fs: lerp(CHROME.poweredText.d.fs, CHROME.poweredText.m.fs, t),
  };
  const adobeLogo = {
    x: lerp(CHROME.adobeLogo.d.x, CHROME.adobeLogo.m.x, t),
    y: lerp(CHROME.adobeLogo.d.y, CHROME.adobeLogo.m.y, t),
    w: lerp(CHROME.adobeLogo.d.w, CHROME.adobeLogo.m.w, t),
    h: lerp(CHROME.adobeLogo.d.h, CHROME.adobeLogo.m.h, t),
  };
  // Helper: lerp every numeric field between d and m configs.
  type NumRec = Record<string, number>;
  const lerpCfg = <T extends { d: NumRec; m?: NumRec }>(cfg: T): NumRec => {
    const m = cfg.m ?? cfg.d;
    const out: NumRec = {};
    for (const k of Object.keys(cfg.d)) {
      out[k] = lerp(cfg.d[k], (m as NumRec)[k] ?? cfg.d[k], t);
    }
    return out;
  };
  const winnerNav = lerpCfg(NAV.winnerNav);

  // Tag base position (lerped). Y is then pushed down to clear any photo it would
  // overlap, so the asterisk/text never sits on top of a photo at any viewport width.
  const tagX = lerp(CHROME.tagBox.d.x, CHROME.tagBox.m.x, t);
  const tagW = lerp(CHROME.tagBox.d.w, CHROME.tagBox.m.w, t);
  const tagH = lerp(CHROME.tagBox.d.h, CHROME.tagBox.m.h, t);
  const tagYNatural = lerp(CHROME.tagBox.d.y, CHROME.tagBox.m.y, t);
  let tagY = tagYNatural;
  const tagLeft = tagX;
  const tagRight = tagX + tagW;
  for (const cfg of ITEMS) {
    if (cfg.kind !== "img" && cfg.kind !== "logo") continue;
    const m = cfg.m ?? cfg.d;
    const px = lerp(cfg.d.x, m.x, t);
    const pw = lerp(cfg.d.w, m.w, t);
    const py = lerp(cfg.d.y, m.y, t);
    const ph = lerp(cfg.d.h, m.h, t);
    // Hero photos only; anything far below would drag the tag down with it.
    if (py > tagYNatural + 200) continue;
    const overlapX = Math.min(px + pw, tagRight) - Math.max(px, tagLeft);
    if (overlapX > 4) {
      const photoBottom = py + ph;
      if (photoBottom + 8 > tagY) tagY = photoBottom + 8;
    }
  }
  const tagBox = { x: tagX, y: tagY, w: tagW, h: tagH };

  const dotGridOpacity = 1 - t * 0.6; // fades but never fully

  // Load-animation spread. easeOut so items fling outward then decelerate into
  // place. spreadFactor: 1 while spread, 0 once landed. Offset each item radially
  // away from the hero cluster anchor by a fraction of its distance from it.
  const landed = 1 - Math.pow(1 - animP, 3);
  const spreadFactor = 1 - landed;
  const spreadAnchor = { x: lerp(720, 200, t), y: lerp(470, 390, t) };
  const SPREAD = 0.7;
  // Lower-section photos sit far below the hero, so they don't take part in the
  // hero fly-in (they'd fling relative to the wrong anchor and off-screen anyway).
  const NO_SPREAD = new Set(["course", "suzie", "tejas"]);
  const spreadFor = (id: string, cx: number, cy: number) => {
    if (spreadFactor <= 0 || NO_SPREAD.has(id)) return { x: 0, y: 0 };
    return {
      x: (cx - spreadAnchor.x) * SPREAD * spreadFactor,
      y: (cy - spreadAnchor.y) * SPREAD * spreadFactor,
    };
  };

  return (
    <div className="relative w-full flex justify-center bg-white overflow-hidden" style={{ minHeight: frameH * scale + 16 }}>
      {/* Full-bleed dot grid — spans the entire viewport width at every screen size,
          including the side gutters beyond the centered canvas. Fades on mobile. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: dotGridOpacity,
          backgroundImage: "radial-gradient(circle, #9a9a9a 1.1px, transparent 1.3px)",
          backgroundSize: "52px 52px",
          backgroundPosition: "26px 67px",
        }}
      />
      <div className="relative" style={{ width: frameW * scale, height: frameH * scale }}>
        <div
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
          className="relative"
          style={{
            width: frameW,
            height: frameH,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >

          {/* Title */}
          <p
            className="absolute font-medium text-center select-none"
            style={{
              left: title.x, top: title.y, width: title.w,
              fontSize: title.fs, lineHeight: 1.1, color: "#000",
            }}
          >
            The Big Idea Fund
          </p>

          {/* Powered by Adobe — text + logo */}
          <p
            className="absolute text-center select-none"
            style={{
              left: poweredText.x, top: poweredText.y, width: poweredText.w,
              fontSize: poweredText.fs, lineHeight: 1, color: "#000",
            }}
          >
            Powered by
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/adobe-logo.png"
            alt="Adobe"
            className="absolute select-none pointer-events-none"
            style={{ left: adobeLogo.x, top: adobeLogo.y, width: adobeLogo.w, height: adobeLogo.h, objectFit: "contain" }}
            draggable={false}
          />

          {/* ===== Everything below the hero ===== */}
          <WinnerSection t={t} onHeight={setSectionH} />

          {/* Draggable items */}
          {ITEMS.map((cfg) => {
            const base = itemPos(cfg);
            const off = offsets[cfg.id] ?? { dx: 0, dy: 0 };
            const sp = spreadFor(cfg.id, base.x + base.w / 2, base.y + base.h / 2);
            const opacity = cfg.m === null ? 1 - t : 1; // desktop-only fades out
            const pointerEvents = opacity < 0.05 ? "none" : "auto";
            return (
              <DraggableItem
                key={cfg.id}
                cfg={cfg}
                x={base.x + off.dx + sp.x}
                y={base.y + off.dy + sp.y}
                w={base.w}
                h={base.h}
                opacity={opacity}
                pointerEvents={pointerEvents}
                selected={selectedId === cfg.id}
                onPointerDown={(e) => startDrag(e, cfg.id)}
              />
            );
          })}

          {/* "creators supporting creators" tag — draggable, crossfades 3-line ↔ 2-line */}
          <TagItem
            x={tagBox.x + (offsets["tag"]?.dx ?? 0) + spreadFor("tag", tagBox.x + tagBox.w / 2, tagBox.y + tagBox.h / 2).x}
            y={tagBox.y + (offsets["tag"]?.dy ?? 0) + spreadFor("tag", tagBox.x + tagBox.w / 2, tagBox.y + tagBox.h / 2).y}
            w={tagBox.w}
            h={tagBox.h}
            t={t}
            selected={selectedId === "tag"}
            onPointerDown={(e) => startDrag(e, "tag")}
          />

          {/* Nav: logo */}
          <a href="/" className="absolute"
            style={{ left: navLogo.x, top: navLogo.y, width: navLogo.w, height: navLogo.h }}>
            <img src="/assets/logo.svg" alt="Creator Support" className="w-full h-full" />
          </a>
          {/* Nav: Adobe logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/adobe-logo.png"
            alt="Adobe"
            className="absolute pointer-events-none"
            style={{ left: navAdobeL.x, top: navAdobeL.y, width: navAdobeL.w, height: navAdobeL.h, objectFit: "contain" }}
            draggable={false}
          />
          {/* Nav: Winner Announced — scrolls down to the announcement copy
              instead of leaving the page. Replaces the Apply button and the
              View Submissions link that stood here while entries were open. */}
          <a href="#winner"
            className="absolute hover:opacity-70 whitespace-nowrap"
            style={{
              right: frameW - (winnerNav.x + WINNER_NAV_W),
              top: winnerNav.y, fontSize: winnerNav.fs, lineHeight: 1, color: "#000",
            }}>
            Winner Announced
          </a>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Items
// =============================================================

function DraggableItem({
  cfg,
  x, y, w, h,
  opacity,
  pointerEvents,
  selected,
  onPointerDown,
}: {
  cfg: ItemConfig;
  x: number; y: number; w: number; h: number;
  opacity: number;
  pointerEvents: "auto" | "none";
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x, top: y, width: w, height: h,
        cursor: "grab", touchAction: "none",
        opacity, pointerEvents,
      }}
      onPointerDown={onPointerDown}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {cfg.kind === "img" && cfg.src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.src} alt={cfg.alt ?? ""} style={cfg.imgStyle} draggable={false} />
        )}
        {cfg.kind === "svg" && cfg.src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.src} alt="" className="w-full h-full block" draggable={false} />
        )}
        {cfg.kind === "logo" && <LogoMark />}
      </div>
      {selected && <SelectionFrame />}
    </div>
  );
}

function TagItem({
  x, y, w, h, t, selected, onPointerDown,
}: {
  x: number; y: number; w: number; h: number; t: number;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  // Crossfade between desktop (3-line, 20px) and mobile (2-line, 15px)
  return (
    <div
      style={{
        position: "absolute",
        left: x, top: y, width: w, height: h,
        cursor: "grab", touchAction: "none",
      }}
      onPointerDown={onPointerDown}
    >
      <div className="absolute inset-0 pointer-events-none">
        {/* Snap between desktop 3-line and mobile 2-line at t=0.5 */}
        {t < 0.5 ? (
          <div
            className="absolute font-medium leading-tight"
            style={{ left: 35, top: 2, fontSize: 20, color: "#000", whiteSpace: "nowrap" }}
          >
            <div>creators</div>
            <div>supporting</div>
            <div>creators</div>
          </div>
        ) : (
          <div
            className="absolute font-medium leading-tight"
            style={{ left: 32, top: 4, fontSize: 15, color: "#000", whiteSpace: "nowrap" }}
          >
            <div>creators supporting</div>
            <div>creators</div>
          </div>
        )}
      </div>
      {selected && <SelectionFrame />}
    </div>
  );
}

function LogoMark() {
  return (
    <div className="absolute inset-0">
      <div
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: "82%", height: "87%",
          background: "#fcf8b8",
          borderTopLeftRadius: 462,
          borderTopRightRadius: 462,
          borderBottomRightRadius: 462,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0, bottom: 0,
          width: "82%", height: "87%",
          background: "#f6e921",
          borderTopLeftRadius: 462,
          borderTopRightRadius: 462,
          borderBottomLeftRadius: 462,
        }}
      />
    </div>
  );
}

function SelectionFrame() {
  const handle: React.CSSProperties = {
    position: "absolute",
    width: 8, height: 8,
    background: "#fff",
    border: "1px solid #b5b5b5",
    boxSizing: "border-box",
  };
  return (
    <>
      <div className="absolute pointer-events-none" style={{ inset: -1, border: "1px solid #b5b5b5" }} />
      <div style={{ ...handle, left: -5, top: -5 }} />
      <div style={{ ...handle, left: "calc(50% - 4px)", top: -5 }} />
      <div style={{ ...handle, right: -5, top: -5 }} />
      <div style={{ ...handle, left: -5, top: "calc(50% - 4px)" }} />
      <div style={{ ...handle, right: -5, top: "calc(50% - 4px)" }} />
      <div style={{ ...handle, left: -5, bottom: -5 }} />
      <div style={{ ...handle, left: "calc(50% - 4px)", bottom: -5 }} />
      <div style={{ ...handle, right: -5, bottom: -5 }} />
    </>
  );
}
