"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DESKTOP_W, MOBILE_W, LERP_MAX, LERP_MIN, lerp, viewportT, NAV } from "@/lib/layout";

// Frame heights are page-specific; widths are shared via lib/layout.
const DESKTOP = { w: DESKTOP_W, h: 1057 };
const MOBILE = { w: MOBILE_W, h: 940 };
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
  // Small mark near subtitle — both layouts. Nudged left so it doesn't sit on the "W" of "We're".
  { id: "v47", kind: "svg", src: "/assets/vector47.svg",
    d: { x: 408, y: 809, w: 14, h: 20 }, m: { x: 22, y: 612, w: 14, h: 20 } },
  // Small chevron near "creators supporting" tag — both layouts
  { id: "v48", kind: "svg", src: "/assets/vector48.svg",
    d: { x: 262, y: 565, w: 6, h: 14.5 }, m: { x: 228, y: 559, w: 6, h: 14.5 } },
];

// Chrome (non-draggable) positions
const CHROME = {
  title:     { d: { x: 514,  y: 141, w: 413, fs: 50 }, m: { x: 42,  y: 124, w: 319, fs: 34 } },
  // Subtitle is a two-line block; height needs to fit two wrapped lines.
  subtitle:  { d: { x: 442,  y: 819, w: 556, fs: 25 }, m: { x: 51,  y: 622, w: 301, fs: 22 } },
  // "Powered by Adobe" — text + logo, sit just under the title.
  poweredText: { d: { x: 603, y: 208, w: 144, fs: 25 }, m: { x: 106, y: 172, w: 117, fs: 20 } },
  adobeLogo:   { d: { x: 743, y: 195, w: 94, h: 51 }, m: { x: 219, y: 160, w: 76, h: 41 } },
  // Two buttons: Apply (yellow) and View Submissions (white outlined)
  applyBtn:  { d: { x: 484,  y: 901, w: 216, h: 53, fs: 25 }, m: { x: 85, y: 796, w: 232, h: 53, fs: 25 } },
  viewBtn:   { d: { x: 724,  y: 901, w: 232, h: 53, fs: 25 }, m: { x: 85, y: 865, w: 232, h: 53, fs: 25 } },
  tagBox:    { d: { x: 238,  y: 558, w: 122, h: 80 }, m: { x: 208, y: 553, w: 170, h: 55 } },
};

// Nav-related layout lives in lib/layout (NAV.logo, NAV.adobe, NAV.viewNav, NAV.applyNav)
// so FluidNav (used on other pages) can render at identical screen positions.

// =============================================================

export default function Canvas() {
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
  const frameH = lerp(DESKTOP.h, MOBILE.h, t);
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
  const subtitle = {
    x: lerp(CHROME.subtitle.d.x, CHROME.subtitle.m.x, t),
    y: lerp(CHROME.subtitle.d.y, CHROME.subtitle.m.y, t),
    w: lerp(CHROME.subtitle.d.w, CHROME.subtitle.m.w, t),
    fs: lerp(CHROME.subtitle.d.fs, CHROME.subtitle.m.fs, t),
  };
  const applyBtn = {
    x: lerp(CHROME.applyBtn.d.x, CHROME.applyBtn.m.x, t),
    y: lerp(CHROME.applyBtn.d.y, CHROME.applyBtn.m.y, t),
    w: lerp(CHROME.applyBtn.d.w, CHROME.applyBtn.m.w, t),
    h: lerp(CHROME.applyBtn.d.h, CHROME.applyBtn.m.h, t),
    fs: lerp(CHROME.applyBtn.d.fs, CHROME.applyBtn.m.fs, t),
  };
  const viewBtn = {
    x: lerp(CHROME.viewBtn.d.x, CHROME.viewBtn.m.x, t),
    y: lerp(CHROME.viewBtn.d.y, CHROME.viewBtn.m.y, t),
    w: lerp(CHROME.viewBtn.d.w, CHROME.viewBtn.m.w, t),
    h: lerp(CHROME.viewBtn.d.h, CHROME.viewBtn.m.h, t),
    fs: lerp(CHROME.viewBtn.d.fs, CHROME.viewBtn.m.fs, t),
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
  const navView = {
    x: NAV.viewNav.d.x, // stays at desktop x; fades by opacity when going mobile
    y: lerp(NAV.viewNav.d.y, NAV.viewNav.m.y, t),
    fs: NAV.viewNav.d.fs,
    opacity: Math.max(0, 1 - t * 2),
  };
  const navApply = {
    x: lerp(NAV.applyNav.d.x, NAV.applyNav.m.x, t),
    y: lerp(NAV.applyNav.d.y, NAV.applyNav.m.y, t),
    w: lerp(NAV.applyNav.d.w, NAV.applyNav.m.w, t),
    h: lerp(NAV.applyNav.d.h, NAV.applyNav.m.h, t),
    fs: lerp(NAV.applyNav.d.fs, NAV.applyNav.m.fs, t),
  };
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
    const overlapX = Math.min(px + pw, tagRight) - Math.max(px, tagLeft);
    if (overlapX > 4) {
      const photoBottom = py + ph;
      if (photoBottom + 8 > tagY) tagY = photoBottom + 8;
    }
  }
  const tagBox = { x: tagX, y: tagY, w: tagW, h: tagH };

  const dotGridOpacity = 1 - t * 0.6; // fades but never fully

  return (
    <div className="w-full flex justify-center bg-white overflow-hidden" style={{ minHeight: frameH * scale + 16 }}>
      <div style={{ width: frameW * scale, height: frameH * scale }}>
        <div
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
          className="relative bg-white"
          style={{
            width: frameW,
            height: frameH,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          {/* Dot grid background — fades on mobile */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: dotGridOpacity,
              backgroundImage: "radial-gradient(circle, #9a9a9a 1.1px, transparent 1.3px)",
              backgroundSize: "52px 52px",
              backgroundPosition: "26px 67px",
            }}
          />

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

          {/* Subtitle — two-line block */}
          <div
            className="absolute text-center select-none"
            style={{
              left: subtitle.x, top: subtitle.y, width: subtitle.w,
              fontSize: subtitle.fs, lineHeight: 1.25, color: "#000",
            }}
          >
            <p style={{ margin: 0 }}>We&rsquo;re giving away $25k to fund your dream project.</p>
            <p style={{ margin: 0 }}>All you have to do is tell us what that big idea is.</p>
          </div>

          {/* Apply button (yellow, black border) */}
          <a
            href="#"
            className="absolute flex items-center justify-center rounded-lg select-none hover:brightness-95 transition-[filter]"
            style={{
              left: applyBtn.x, top: applyBtn.y, width: applyBtn.w, height: applyBtn.h,
              background: "#f6e921", border: "1px solid #000",
              fontSize: applyBtn.fs, color: "#000",
            }}
          >
            Apply
          </a>

          {/* View Submissions button (white, black border) */}
          <a
            href="/submissions"
            className="absolute flex items-center justify-center rounded-lg select-none hover:bg-neutral-50 transition-colors"
            style={{
              left: viewBtn.x, top: viewBtn.y, width: viewBtn.w, height: viewBtn.h,
              background: "#fff", border: "1px solid #000",
              fontSize: viewBtn.fs, color: "#000",
            }}
          >
            View Submissions
          </a>

          {/* Draggable items */}
          {ITEMS.map((cfg) => {
            const base = itemPos(cfg);
            const off = offsets[cfg.id] ?? { dx: 0, dy: 0 };
            const opacity = cfg.m === null ? 1 - t : 1; // desktop-only fades out
            const pointerEvents = opacity < 0.05 ? "none" : "auto";
            return (
              <DraggableItem
                key={cfg.id}
                cfg={cfg}
                x={base.x + off.dx}
                y={base.y + off.dy}
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
            x={tagBox.x + (offsets["tag"]?.dx ?? 0)}
            y={tagBox.y + (offsets["tag"]?.dy ?? 0)}
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
          {/* Nav: View Submissions (desktop only — fades on mobile) */}
          {navView.opacity > 0.01 && (
            <a href="/submissions" className="absolute font-semibold hover:opacity-70 whitespace-nowrap"
              style={{ left: navView.x, top: navView.y, fontSize: navView.fs, lineHeight: 1, color: "#000", opacity: navView.opacity }}>
              View Submissions
            </a>
          )}
          {/* Nav: Apply (yellow bg centered around text; paddingTop:2 keeps baseline aligned) */}
          <a href="#"
            className="absolute font-semibold hover:opacity-70 flex justify-center"
            style={{
              left: navApply.x, top: navApply.y,
              width: navApply.w, height: navApply.h,
              background: "#f6e921",
              fontSize: navApply.fs, lineHeight: 1, color: "#000",
              paddingTop: 2,
            }}>
            Apply
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
