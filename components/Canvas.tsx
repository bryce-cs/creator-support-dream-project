"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ItemKind = "img" | "svg" | "logo" | "text";

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

const INITIAL_ITEMS: Item[] = [
  // Photos — positions and sizes are the OUTER container box from Figma.
  // imgStyle replicates the inner overflow/scale crop so the visible portion matches.
  {
    id: "bryce",
    kind: "img",
    x: 363, y: 295, w: 423, h: 282,
    src: "/assets/bryce.webp", alt: "Bryce Andersen",
    imgStyle: { height: "155.62%", left: "-13.62%", top: "-17.76%", width: "155.6%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "amanda",
    kind: "img",
    x: 714, y: 498, w: 386, h: 257,
    src: "/assets/amanda.webp", alt: "Amanda Rach Lee",
    imgStyle: { height: "124.62%", left: "-12.4%", top: "0.04%", width: "124.62%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "james",
    kind: "img",
    x: 607, y: 519, w: 142, h: 205,
    src: "/assets/james.webp", alt: "James Seo",
    imgStyle: { height: "318.8%", left: "-113.98%", top: "-73.33%", width: "307.04%", position: "absolute", maxWidth: "none" },
  },
  {
    id: "live05",
    kind: "img",
    x: 985, y: 243, w: 191, h: 286,
    src: "/assets/live05.webp", alt: "Live photos",
    imgStyle: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, maxWidth: "none" },
  },
  {
    id: "live06",
    kind: "img",
    x: 867, y: 325, w: 146, h: 220,
    src: "/assets/live06.webp", alt: "Live photos",
    imgStyle: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, maxWidth: "none" },
  },
  {
    id: "colt",
    kind: "img",
    x: 382, y: 524, w: 182, h: 165,
    src: "/assets/colt.webp", alt: "Colt",
    imgStyle: { height: "100.17%", left: "-24.58%", top: "-0.08%", width: "135.83%", position: "absolute", maxWidth: "none" },
  },
  // Two-circle yellow logo (treated as a single draggable group)
  { id: "logo", kind: "logo", x: 653, y: 420, w: 133, h: 125 },
  // "creators supporting creators" text + asterisk grouped as text item
  { id: "tag", kind: "text", x: 238, y: 558, w: 130, h: 75 },
  // Vector markings
  { id: "v42", kind: "svg", x: 763, y: 276, w: 38.5, h: 50, src: "/assets/vector42.svg" },
  { id: "v43", kind: "svg", x: 655, y: 734, w: 99, h: 33.5, src: "/assets/vector43.svg" },
  { id: "v44", kind: "svg", x: 344, y: 296.5, w: 11, h: 38.5, src: "/assets/vector44.svg" },
  { id: "v45", kind: "svg", x: 1109, y: 539, w: 48.5, h: 56, src: "/assets/vector45.svg" },
];

const FRAME_W = 1440;
const FRAME_H = 1057; // 1024 + nav offset

export default function Canvas() {
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [selectedId, setSelectedId] = useState<string | null>("live05");
  const draggingRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startItemX: number;
    startItemY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const onPointerDownItem = useCallback(
    (e: React.PointerEvent, item: Item) => {
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
    },
    []
  );

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = draggingRef.current;
    if (!d) return;
    const deltaX = e.clientX - d.startClientX;
    const deltaY = e.clientY - d.startClientY;
    setItems((prev) =>
      prev.map((it) =>
        it.id === d.id
          ? {
              ...it,
              x: Math.min(Math.max(0, d.startItemX + deltaX), FRAME_W - it.w),
              y: Math.min(Math.max(0, d.startItemY + deltaY), FRAME_H - it.h),
            }
          : it
      )
    );
  }, []);

  const onPointerUp = useCallback(() => {
    draggingRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isDragging, onPointerMove, onPointerUp]);

  // Click empty canvas deselects
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) setSelectedId(null);
  };

  return (
    <div className="w-full min-h-screen flex justify-center bg-white overflow-x-auto">
      <div
        ref={canvasRef}
        onPointerDown={onCanvasPointerDown}
        className="relative bg-white"
        style={{
          width: FRAME_W,
          height: FRAME_H,
          backgroundImage:
            "radial-gradient(circle, #9a9a9a 1.1px, transparent 1.3px)",
          backgroundSize: "52px 52px",
          backgroundPosition: "26px 67px",
        }}
      >
        {/* Title */}
        <p
          className="absolute font-medium select-none"
          style={{ left: 514, top: 174, width: 413, fontSize: 50, lineHeight: 1.1, color: "#000" }}
        >
          The Dream Project
        </p>

        {/* Bottom blurb */}
        <p
          className="absolute text-center select-none"
          style={{ left: 513, top: 805, width: 413, fontSize: 25, lineHeight: 1.15, color: "#000" }}
        >
          We&rsquo;re giving away $25k to fund your dream project. Powered by Adobe.
        </p>

        {/* Learn More button (eventually a link) */}
        <a
          href="#"
          className="absolute flex items-center justify-center rounded-lg select-none hover:brightness-95 transition"
          style={{
            left: 612, top: 893, width: 216, height: 53,
            background: "#f6e921",
            border: "1px solid #000",
            fontSize: 25, color: "#000",
          }}
        >
          Learn More
        </a>

        {/* Draggable items */}
        {items.map((item) => (
          <DraggableItem
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onPointerDown={(e) => onPointerDownItem(e, item)}
          />
        ))}

        {/* Nav Bar (fixed within frame, above the canvas dots) */}
        <NavBar />
      </div>
    </div>
  );
}

function NavBar() {
  return (
    <div className="absolute left-0 top-0 w-full h-[100px] pointer-events-none">
      {/* logo */}
      <a
        href="/"
        className="absolute pointer-events-auto"
        style={{ left: 45, top: 38, width: 125, height: 44 }}
      >
        <img src="/assets/logo.svg" alt="Creator Support" className="w-full h-full" />
      </a>
      <a
        href="#"
        className="absolute pointer-events-auto font-medium hover:opacity-70"
        style={{ left: 1193, top: 49, fontSize: 20, color: "#000" }}
      >
        About
      </a>
      <a
        href="#"
        className="absolute pointer-events-auto font-medium flex items-center justify-center hover:brightness-95"
        style={{
          left: 1301, top: 47, width: 79, height: 28,
          background: "#f6e921", fontSize: 20, color: "#000",
        }}
      >
        Submit
      </a>
    </div>
  );
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
      </div>
      {selected && <SelectionFrame />}
    </div>
  );
}

function LogoMark() {
  // Two overlapping rounded-asymmetric circles, matching Figma
  return (
    <div className="absolute inset-0">
      <div
        style={{
          position: "absolute",
          left: 0, top: 0, width: 109, height: 109,
          background: "#fcf8b8",
          borderTopLeftRadius: 462,
          borderTopRightRadius: 462,
          borderBottomRightRadius: 462,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 24, top: 16, width: 109, height: 109,
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
      {/* asterisk */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/vector41.svg"
        alt=""
        style={{ position: "absolute", left: 0, top: 0, width: 22.5, height: 32 }}
        draggable={false}
      />
      <div
        className="absolute font-medium leading-tight"
        style={{ left: 35, top: 2, fontSize: 20, color: "#000", whiteSpace: "nowrap" }}
      >
        <div>creators</div>
        <div>supporting</div>
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
      <div
        className="absolute pointer-events-none"
        style={{ inset: -1, border: "1px solid #b5b5b5" }}
      />
      {/* 8 handles: corners + midpoints */}
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
