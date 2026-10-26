"use client";

import { useEffect, useRef, useState } from "react";
import { lerp } from "@/lib/layout";
import {
  ADOBE_INCUBATOR_URL, COLIN_AND_SAMIR_URL, PINKERTONS_VIDEO_URL,
  PITCH_VIDEO_ID, STORIES_MADE_WITH_LOVE_URL,
} from "@/lib/links";

/**
 * Everything below the hero collage: the announcement, Jackson's pitch, the
 * winner reveal, the reopening notice, the Adobe box and the footer.
 *
 * The hero above this is absolutely positioned at fixed frame coordinates, the
 * way the whole page used to be. This section is NOT — it is one normal-flow
 * column dropped into the same scaled frame, so a copy edit reflows the blocks
 * underneath it instead of silently overlapping them. Measured desktop metrics
 * (widths, type sizes, the gaps between blocks) still come straight from the
 * Figma; only the stacking is left to the browser.
 *
 * The parent asks for the measured height so it can size the frame around it.
 */

/** Where the column sits inside the frame, desktop -> mobile. */
export const SECTION = {
  top: { d: 819, m: 640 },
  x: { d: 271, m: 26 },
  w: { d: 898, m: 350 },
  /** Whitespace left under the footer at the bottom of the frame. */
  bottomPad: { d: 58, m: 48 },
};

/** Vertical gaps between blocks, desktop -> mobile. Keys read top to bottom. */
const GAP = {
  introToVideo: { d: 23, m: 34 },
  videoToStory: { d: 41, m: 40 },
  storyToReveal: { d: 23, m: 40 },
  revealToCheck: { d: 21, m: 26 },
  checkToFlew: { d: 36, m: 34 },
  flewToThanks: { d: 68, m: 56 },
  thanksToAdobe: { d: 50, m: 44 },
  adobeToFooter: { d: 57, m: 48 },
};

/** Inner widths and type sizes, desktop -> mobile. */
const SPEC = {
  introW: { d: 676, m: 350 },
  // Asterisk offset from the intro block's top-left. Pushed out into the left
  // margin: the live font is wider than the Figma's, so the first line reaches
  // further left than the mock and would otherwise collide with the mark.
  asterX: { d: -26, m: -18 },
  asterY: { d: -14, m: -12 },
  videoW: { d: 744, m: 350 },
  revealW: { d: 637, m: 350 },
  flewTextW: { d: 501, m: 350 },
  flewPhotoW: { d: 359, m: 350 },
  bodyFs: { d: 25, m: 19 },
  headingFs: { d: 35, m: 25 },
  bannerFs: { d: 35, m: 24 },
  bannerH: { d: 40, m: 30 },
  footerFs: { d: 20, m: 18 },
  btnW: { d: 224, m: 200 },
  btnH: { d: 53, m: 48 },
  btnFs: { d: 25, m: 20 },
};

/** Line height used for every body paragraph. Matches the Figma's "normal". */
const BODY_LH = 1.2;

const YELLOW = "#f6e921";
const RED = "#eb1000";

export default function WinnerSection({
  t,
  onHeight,
}: {
  /** 0 = desktop frame, 1 = mobile frame. Same t the hero lerps on. */
  t: number;
  onHeight: (h: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // The frame's height depends on how tall this column renders, which depends on
  // where the copy wraps. Measure it rather than hardcoding a number that a copy
  // edit would quietly invalidate.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onHeight(el.getBoundingClientRect().height / (currentScale(el) || 1));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight, t]);

  const L = (k: { d: number; m: number }) => lerp(k.d, k.m, t);
  const stacked = t > 0.5;

  const bodyFs = L(SPEC.bodyFs);
  const colW = L(SECTION.w);
  /** A blank line between paragraphs, same height as a line of body copy. */
  const para = { margin: `${bodyFs * BODY_LH}px 0 0` } as const;

  const link: React.CSSProperties = {
    color: "inherit",
    textDecoration: "underline",
    textUnderlineOffset: "0.12em",
  };

  return (
    <div
      ref={ref}
      className="absolute"
      style={{ left: L(SECTION.x), top: L(SECTION.top), width: colW, color: "#000" }}
    >
      {/* ---- Announcement. The asterisk pairs with the one beside the title. ---- */}
      <div
        id="winner"
        className="relative select-none"
        style={{
          width: L(SPEC.introW), margin: "0 auto", textAlign: "center",
          fontSize: bodyFs, lineHeight: BODY_LH,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/vector47.svg" alt="" aria-hidden
          className="absolute pointer-events-none"
          style={{ left: L(SPEC.asterX), top: L(SPEC.asterY), width: 14, height: 20 }}
        />
        <p style={{ margin: 0 }}>
          We asked creators to tell us their biggest ideas for a chance to win $25,000 in funding.
        </p>
        <p style={para}>
          Hundreds of incredible creators{" "}
          <a href="/submissions" className="hover:opacity-70" style={link}>submitted</a>. We were
          so inspired to see everyone going after something they cared about.
        </p>
        <p style={{ ...para, fontWeight: 500 }}>One idea stood out.</p>
      </div>

      {/* ---- Jackson's pitch ---- */}
      <div style={{ width: L(SPEC.videoW), margin: `${L(GAP.introToVideo)}px auto 0` }}>
        <PitchVideo width={L(SPEC.videoW)} />
      </div>

      {/* ---- Who they are, and why this pitch ---- */}
      <div
        className="select-none"
        style={{
          marginTop: L(GAP.videoToStory), width: "100%",
          fontSize: bodyFs, lineHeight: BODY_LH,
        }}
      >
        <p style={{ margin: 0 }}>
          Jackson and his dad David Hughens run{" "}
          <a href={STORIES_MADE_WITH_LOVE_URL} target="_blank" rel="noopener noreferrer"
            className="hover:opacity-70" style={link}>Stories Made With Love</a>, a channel
          dedicated to changing how people see the intellectual and developmental disability
          community.
        </p>
        <p style={para}>
          Their pitch was to build on one of their{" "}
          <a href={PINKERTONS_VIDEO_URL} target="_blank" rel="noopener noreferrer"
            className="hover:opacity-70" style={link}>most impactful stories</a>: the Pinkertons,
          a family who adopted five boys with Down syndrome.
        </p>
        <p style={para}>
          Ever since, they&rsquo;ve wanted to go back and make a five-part docuseries - one
          episode for each of the boys. They just never had the resources.
        </p>
        <p style={para}>
          We heard their pitch and saw the impact they&rsquo;re already having. Along with Adobe,
          we knew.
        </p>
      </div>

      {/* ---- The reveal, then the photo it leads into ---- */}
      <p
        className="font-medium text-center select-none"
        style={{
          width: L(SPEC.revealW), margin: `${L(GAP.storyToReveal)}px auto 0`,
          fontSize: L(SPEC.headingFs), lineHeight: 1.2,
        }}
      >
        The winner of the first ever Big Idea Fund:
      </p>

      {/* Photo is cropped exactly as in the Figma: full width, 135.64% tall,
          pulled up 16.81% so the crop sits on the check rather than the sky. */}
      <div
        className="relative overflow-hidden"
        style={{
          marginTop: L(GAP.revealToCheck), width: "100%",
          height: colW * (474 / 898),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/winner-check.webp"
          alt="Jackson and David Hughens holding the $25,000 Big Idea Fund check, surrounded by creators"
          className="absolute pointer-events-none max-w-none"
          style={{ left: 0, top: "-16.81%", width: "100%", height: "135.64%" }}
          draggable={false}
        />
      </div>

      {/* ---- What happened on the day. Photo sits beside it until mobile. ---- */}
      <div
        style={{
          marginTop: L(GAP.checkToFlew), display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: 24,
          flexDirection: stacked ? "column" : "row",
        }}
      >
        <div
          className="select-none"
          style={{ width: stacked ? "100%" : L(SPEC.flewTextW), fontSize: bodyFs, lineHeight: BODY_LH }}
        >
          <p style={{ margin: 0 }}>
            We flew out Jackson and David and presented them with the $25,000 check in front of a
            community of creators and got to sit down with them on Creator Support.
          </p>
          <p style={para}>
            Congratulations Jackson &amp; David. We are so excited to be a part of your journey and
            see this series.
          </p>
        </div>
        <div
          className="relative overflow-hidden shrink-0"
          style={{
            width: stacked ? "100%" : L(SPEC.flewPhotoW),
            height: (stacked ? colW : L(SPEC.flewPhotoW)) * (257 / 359),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/winner-interview.webp"
            alt="Colin, Samir, Jackson and David sitting down together on Creator Support"
            className="absolute inset-0 w-full h-full pointer-events-none max-w-none"
            style={{ objectFit: "cover" }}
            draggable={false}
          />
        </div>
      </div>

      {/* ---- Thank you + what's next ---- */}
      <div
        className="select-none flex flex-col items-center bg-white"
        style={{
          marginTop: L(GAP.flewToThanks), width: "100%", border: "1px solid #000",
          paddingTop: lerp(39, 30, t), paddingBottom: lerp(49, 34, t),
          paddingLeft: lerp(0, 16, t), paddingRight: lerp(0, 16, t),
        }}
      >
        <div style={{ textAlign: "center", fontSize: bodyFs, lineHeight: BODY_LH }}>
          <p style={{ margin: 0 }}>
            Thank you to everyone who submitted. We&rsquo;re so proud to be part of this
            community.
          </p>
          <p style={para}>So we&rsquo;re not letting it end here:</p>
        </div>
        {/* Two yellow bars. Each sizes itself to its own line, so the highlight
            still fits snugly if the wording changes. */}
        <div
          style={{
            marginTop: lerp(18, 20, t), display: "flex", flexDirection: "column",
            alignItems: "center", rowGap: 4,
          }}
        >
          {["The Big Idea Fund", "Applications Reopening Soon"].map((line) => (
            <span
              key={line}
              className="font-medium"
              style={{
                background: YELLOW, padding: "0 10px",
                fontSize: L(SPEC.bannerFs), lineHeight: `${L(SPEC.bannerH)}px`,
                whiteSpace: "nowrap",
              }}
            >
              {line}
            </span>
          ))}
        </div>
      </div>

      {/* ---- Adobe Creator Incubator ---- */}
      <div
        className="flex flex-col items-center"
        style={{
          marginTop: L(GAP.thanksToAdobe), width: "100%",
          background: "#fff", border: `2px solid ${RED}`,
          paddingTop: lerp(23, 28, t), paddingBottom: lerp(40, 32, t),
          paddingLeft: lerp(28, 20, t), paddingRight: lerp(28, 20, t),
          rowGap: lerp(30, 28, t),
        }}
      >
        <p className="select-none m-0" style={{ fontSize: bodyFs, lineHeight: 1.4, width: "100%" }}>
          Adobe tools have been part of every project Colin &amp; Samir have made. If you&rsquo;re a
          creator who wants free access to Creative Cloud, learn more about the Adobe Creator
          Incubator:
        </p>
        <a
          href={ADOBE_INCUBATOR_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center rounded-lg select-none hover:brightness-95 transition-[filter]"
          style={{
            width: L(SPEC.btnW), height: L(SPEC.btnH), flexShrink: 0,
            background: RED, fontSize: L(SPEC.btnFs), color: "#fff",
          }}
        >
          Learn More
        </a>
      </div>

      {/* ---- Footer ---- */}
      <div
        className="flex flex-wrap justify-center select-none"
        style={{
          marginTop: L(GAP.adobeToFooter), width: "100%",
          fontSize: L(SPEC.footerFs), columnGap: 24, rowGap: 6,
        }}
      >
        <a href={COLIN_AND_SAMIR_URL} target="_blank" rel="noopener noreferrer"
          className="hover:opacity-70" style={{ color: "#595959", textDecoration: "underline" }}>
          Colin and Samir
        </a>
      </div>
    </div>
  );
}

/**
 * Jackson's pitch. Renders as a poster frame with the design's play triangle and
 * only swaps in YouTube's iframe once it is clicked, so landing on the page
 * costs one image rather than YouTube's player and its cookies.
 */
function PitchVideo({ width }: { width: number }) {
  const [playing, setPlaying] = useState(false);
  const height = (width * 9) / 16;
  const tri = width * 0.137; // 102px against the Figma's 744px frame

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${PITCH_VIDEO_ID}?autoplay=1&rel=0`}
        title="Jackson's Big Idea Fund pitch"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width, height, border: 0, display: "block" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label="Play Jackson's Big Idea Fund pitch"
      className="group relative block cursor-pointer overflow-hidden p-0"
      style={{ width, height, border: 0, background: "#000" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/winner-pitch-poster.webp" alt=""
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover" }}
        draggable={false}
      />
      <svg
        viewBox="0 0 55.5 64.0859"
        className="absolute pointer-events-none"
        style={{ left: "50%", top: "50%", width: tri, height: tri, transform: "translate(-45%, -50%)" }}
        aria-hidden
      >
        <path className="play-triangle" d="M0 0 L55.5 32.0429 L0 64.0859 Z" />
      </svg>
    </button>
  );
}

/**
 * Effective horizontal scale an element is rendered at. The column lives inside
 * the frame's `transform: scale(...)`, so its measured box is in screen pixels;
 * dividing by the scale puts the height back into frame coordinates.
 */
function currentScale(el: HTMLElement): number {
  const w = el.getBoundingClientRect().width;
  return w > 0 ? w / el.offsetWidth : 1;
}
