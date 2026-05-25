"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ItemKind = "img" | "svg" | "logo" | "text" | "text-mobile";

interface Item {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  src?: string;
  alt?: string;
  imgStyle?: React.CSSProperties;
}

// ---------- Desktop items (1440 x 1057, matches Figma) ----------
const DESKTOP_ITEMS: Item[] = [
  {
    id: "bryce", kind: "img",
    x: 363, y: 295, w: 423, h: 282,
    src: "/assets/bryce.webp", alt: "Bryce Andersen",
    imgStyle: { height: "155.62%", left: "-13.62%", top: "-17.76%", width: "155.6%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "amanda", kind: "img",
    x: 714, y: 498, w: 386, h: 257,
    src: "/assets/amanda.webp", alt: "Amanda Rach Lee",
    imgStyle: { height: "124.62%", left: "-12.4%", top: "0.04%", width: "124.62%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "james", kind: "img",
    x: 607, y: 519, w: 142, h: 205,
    src: "/assets/james.webp", alt: "James Seo",
    imgStyle: { height: "318.8%", left: "-113.98%", top: "-73.33%", width: "307.04%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "live05", kind: "img",
    x: 985, y: 243, w: 191, h: 286,
    src: "/assets/live05.webp", alt: "Live photos",
    imgStyle: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, maxWidth: "none" },
  },
  {
    id: "live06", kind: "img",
    x: 867, y: 325, w: 146, h: 220,
    src: "/assets/live06.webp", alt: "Live photos",
    imgStyle: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, maxWidth: "none" },
  },
  {
    id: "colt", kind: "img",
    x: 382, y: 524, w: 182, h: 165,
    src: "/assets/colt.webp", alt: "Colt",
    imgStyle: { height: "100.17%", left: "-24.58%", top: "-0.08%", width: "135.83%", position: "absolute", maxWidth: "none" },
  },
  { id: "logo", kind: "logo", x: 653, y: 420, w: 133, h: 125 },
  { id: "tag", kind: "text", x: 238, y: 558, w: 175, h: 80 },
  { id: "v42", kind: "svg", x: 763, y: 276, w: 38.5, h: 50, src: "/assets/vector42.svg" },
  { id: "v43", kind: "svg", x: 655, y: 734, w: 99, h: 33.5, src: "/assets/vector43.svg" },
  { id: "v44", kind: "svg", x: 344, y: 296.5, w: 11, h: 38.5, src: "/assets/vector44.svg" },
  { id: "v45", kind: "svg", x: 1109, y: 539, w: 48.5, h: 56, src: "/assets/vector45.svg" },
];

// ---------- Mobile items (402 x 874, matches Figma mobile frame) ----------
const MOBILE_ITEMS: Item[] = [
  {
    id: "bryce", kind: "img",
    x: 26, y: 234, w: 245, h: 163,
    src: "/assets/bryce.webp", alt: "Bryce Andersen",
    imgStyle: { height: "155.62%", left: "-13.62%", top: "-17.76%", width: "155.6%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "colt", kind: "img",
    x: -15, y: 364, w: 115, h: 104,
    src: "/assets/colt.webp", alt: "Colt",
    imgStyle: { height: "100.17%", left: "-24.58%", top: "-0.08%", width: "135.83%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "james", kind: "img",
    x: 73, y: 395, w: 118, h: 170,
    src: "/assets/james.webp", alt: "James Seo",
    imgStyle: { height: "318.8%", left: "-113.98%", top: "-73.33%", width: "307.04%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "amanda", kind: "img",
    x: 215, y: 393, w: 222, h: 148,
    src: "/assets/amanda.webp", alt: "Amanda Rach Lee",
    imgStyle: { height: "124.62%", left: "-12.4%", top: "0.04%", width: "124.62%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "live05", kind: "img",
    x: 321, y: 245, w: 123, h: 184,
    src: "/assets/live05.webp", alt: "Live photos",
    imgStyle: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, maxWidth: "none" },
  },
  {
    id: "live06", kind: "img",
    x: 247, y: 256, w: 98, h: 147,
    src: "/assets/live06.webp", alt: "Live photos",
    imgStyle: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, maxWidth: "none" },
  },
  { id: "logo", kind: "logo", x: 150, y: 342, w: 101, h: 95 },
  { id: "tag", kind: "text-mobile", x: 208, y: 553, w: 170, h: 55 },
  { id: "v44", kind: "svg", x: 8, y: 234, w: 9, h: 31, src: "/assets/vector44.svg" },
  { id: "v42", kind: "svg", x: 264, y: 212, w: 25, h: 33, src: "/assets/vector42.svg" },
  { id: "v45", kind: "svg", x: 304, y: 582, w: 13, h: 15, src: "/assets/vector45.svg" },
];

const MOBILE_BREAKPOINT = 768;

export default function Canvas() {
  const [mode, setMode] = useState<"desktop" | "mobile" | null>(null);

  useEffect(() => {
    const calc = () => setMode(window.innerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop");
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  if (mode === null) return <div style={{ minHeight: "100vh", background: "#fff" }} />;
  return mode === "mobile" ? <MobileCanvas /> : <DesktopCanvas />;
}

// =============================================================
// DESKTOP
// =============================================================

function DesktopCanvas() {
  const FRAME_W = 1440;
  const FRAME_H = 1057;

  const [items, setItems] = useState<Item[]>(DESKTOP_ITEMS);
  const [selectedId, setSelectedId] = useState<string | null>("james");
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setScale(w >= FRAME_W + 32 ? 1 : w / FRAME_W);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const drag = useDragHandlers(setItems, scaleRef, FRAME_W, FRAME_H);

  return (
    <div className="w-full flex justify-center bg-white overflow-hidden">
      <div style={{ width: FRAME_W * scale, height: FRAME_H * scale }}>
        <div
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
          className="relative bg-white"
          style={{
            width: FRAME_W,
            height: FRAME_H,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            backgroundImage: "radial-gradient(circle, #9a9a9a 1.1px, transparent 1.3px)",
            backgroundSize: "52px 52px",
            backgroundPosition: "26px 67px",
          }}
        >
          <p className="absolute font-medium select-none"
            style={{ left: 514, top: 174, width: 413, fontSize: 50, lineHeight: 1.1, color: "#000" }}>
            The Dream Project
          </p>
          <p className="absolute text-center select-none"
            style={{ left: 513, top: 805, width: 413, fontSize: 25, lineHeight: 1.15, color: "#000" }}>
            We&rsquo;re giving away $25k to fund your dream project. Powered by Adobe.
          </p>
          <a href="#"
            className="absolute flex items-center justify-center rounded-lg select-none hover:brightness-95 transition"
            style={{ left: 612, top: 893, width: 216, height: 53, background: "#f6e921", border: "1px solid #000", fontSize: 25, color: "#000" }}>
            Learn More
          </a>

          {items.map((item) => (
            <DraggableItem
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onPointerDown={(e) => drag.start(e, item, setSelectedId)}
            />
          ))}

          {/* Desktop nav */}
          <div className="absolute left-0 top-0 w-full h-[100px] pointer-events-none">
            <a href="/" className="absolute pointer-events-auto"
              style={{ left: 45, top: 38, width: 125, height: 44 }}>
              <img src="/assets/logo.svg" alt="Creator Support" className="w-full h-full" />
            </a>
            <a href="#" className="absolute pointer-events-auto font-medium hover:opacity-70"
              style={{ left: 1193, top: 49, fontSize: 20, lineHeight: 1, color: "#000" }}>About</a>
            {/* Submit: yellow bg behind, text positioned to share About's baseline */}
            <div className="absolute pointer-events-none"
              style={{ left: 1301, top: 47, width: 79, height: 28, background: "#f6e921" }} />
            <a href="#" className="absolute pointer-events-auto font-medium hover:opacity-70"
              style={{ left: 1308, top: 49, fontSize: 20, lineHeight: 1, color: "#000" }}>Submit</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// MOBILE
// =============================================================

function MobileCanvas() {
  const FRAME_W = 402;
  const FRAME_H = 874;

  const [items, setItems] = useState<Item[]>(MOBILE_ITEMS);
  const [selectedId, setSelectedId] = useState<string | null>("james");
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  useEffect(() => {
    const calc = () => setScale(Math.min(1, window.innerWidth / FRAME_W));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const drag = useDragHandlers(setItems, scaleRef, FRAME_W, FRAME_H);

  return (
    <div className="w-full flex justify-center bg-white overflow-hidden">
      <div style={{ width: FRAME_W * scale, height: FRAME_H * scale }}>
        <div
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
          className="relative bg-white"
          style={{
            width: FRAME_W,
            height: FRAME_H,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          {/* Title */}
          <p className="absolute font-medium text-center select-none"
            style={{ left: 201.5, top: 132, width: 319, transform: "translateX(-50%)", fontSize: 30, lineHeight: 1.1, color: "#000" }}>
            The Dream Project
          </p>

          {/* Subtitle */}
          <p className="absolute text-center select-none"
            style={{ left: 201.5, top: 659, width: 301, transform: "translateX(-50%)", fontSize: 25, lineHeight: 1.15, color: "#000" }}>
            We&rsquo;re giving away $25k to fund your dream project. Powered by Adobe.
          </p>

          {/* Learn More button */}
          <a href="#"
            className="absolute flex items-center justify-center rounded-lg select-none hover:brightness-95 transition"
            style={{ left: 113, top: 766, width: 176, height: 53, background: "#f6e921", border: "1px solid #000", fontSize: 25, color: "#000" }}>
            Learn More
          </a>

          {/* Draggable collage items */}
          {items.map((item) => (
            <DraggableItem
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onPointerDown={(e) => drag.start(e, item, setSelectedId)}
            />
          ))}

          {/* Mobile nav (matches Figma 4416:1917) */}
          <a href="/" className="absolute"
            style={{ left: 26, top: 28, width: 108, height: 38 }}>
            <img src="/assets/logo.svg" alt="Creator Support" className="w-full h-full" />
          </a>
          <a href="#" className="absolute font-medium hover:opacity-70"
            style={{ left: 205, top: 43, fontSize: 20, lineHeight: 1, color: "#000" }}>About</a>
          <div className="absolute"
            style={{ left: 289, top: 41, width: 79, height: 28, background: "#f6e921" }} />
          <a href="#" className="absolute font-medium hover:opacity-70"
            style={{ left: 296, top: 43, fontSize: 20, lineHeight: 1, color: "#000" }}>Submit</a>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// SHARED: drag, item, selection
// =============================================================

function useDragHandlers(
  setItems: React.Dispatch<React.SetStateAction<Item[]>>,
  scaleRef: React.RefObject<number>,
  frameW: number,
  frameH: number
) {
  const draggingRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startItemX: number;
    startItemY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onMove = useCallback((e: PointerEvent) => {
    const d = draggingRef.current;
    if (!d) return;
    const s = scaleRef.current || 1;
    const dx = (e.clientX - d.startClientX) / s;
    const dy = (e.clientY - d.startClientY) / s;
    setItems((prev) =>
      prev.map((it) =>
        it.id === d.id
          ? {
              ...it,
              x: Math.min(Math.max(0, d.startItemX + dx), frameW - it.w),
              y: Math.min(Math.max(0, d.startItemY + dy), frameH - it.h),
            }
          : it
      )
    );
  }, [setItems, scaleRef, frameW, frameH]);

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

  const start = useCallback((
    e: React.PointerEvent,
    item: Item,
    setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(item.id);
    draggingRef.current = {
      id: item.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startItemX: item.x,
      startItemY: item.y,
    };
    setIsDragging(true);
  }, []);

  return { start };
}

function DraggableItem({
  item,
  selected,
  onPointerDown,
}: {
  item: Item;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: item.x,
    top: item.y,
    width: item.w,
    height: item.h,
    cursor: "grab",
    touchAction: "none",
  };

  return (
    <div style={baseStyle} onPointerDown={onPointerDown}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {item.kind === "img" && item.src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.src} alt={item.alt ?? ""} style={item.imgStyle} draggable={false} />
        )}
        {item.kind === "svg" && item.src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.src} alt="" className="w-full h-full block" draggable={false} />
        )}
        {item.kind === "logo" && <LogoMark />}
        {item.kind === "text" && <CreatorsTag />}
        {item.kind === "text-mobile" && <CreatorsTagMobile />}
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

function CreatorsTag() {
  return (
    <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/vector41.svg" alt=""
        style={{ position: "absolute", left: 0, top: 0, width: 22.5, height: 32 }}
        draggable={false} />
      <div className="absolute font-medium leading-tight"
        style={{ left: 35, top: 2, fontSize: 20, color: "#000", whiteSpace: "nowrap" }}>
        <div>creators</div>
        <div>supporting</div>
        <div>creators</div>
      </div>
    </div>
  );
}

function CreatorsTagMobile() {
  return (
    <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/vector41.svg" alt=""
        style={{ position: "absolute", left: 0, top: 0, width: 22.5, height: 32 }}
        draggable={false} />
      <div className="absolute font-medium leading-tight"
        style={{ left: 32, top: 4, fontSize: 15, color: "#000", whiteSpace: "nowrap" }}>
        <div>creators supporting</div>
        <div>creators</div>
      </div>
    </div>
  );
}

function SelectionFrame() {
  const handle: React.CSSProperties = {
    position: "absolute",
    width: 8,
    height: 8,
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
