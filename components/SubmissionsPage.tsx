"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import FluidNav from "./FluidNav";
import type { Submission, SortOption } from "@/lib/submissions";
import { sortSubmissions, youtubeThumbnail } from "@/lib/submissions";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Most Recent",
  liked: "Most Liked",
  random: "Random",
};

export default function SubmissionsPage({ submissions }: { submissions: Submission[] }) {
  const [sort, setSort] = useState<SortOption>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  // Re-shuffle when sort=random by tracking a tick value
  const [randomTick, setRandomTick] = useState(0);

  const sorted = useMemo(() => {
    // randomTick included to retrigger memo on every random selection
    void randomTick;
    return sortSubmissions(submissions, sort);
  }, [submissions, sort, randomTick]);

  const sortRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const onPickSort = (s: SortOption) => {
    setSort(s);
    if (s === "random") setRandomTick((n) => n + 1);
    setSortOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <FluidNav />

      <main className="px-5 sm:px-12 pb-24">
        {/* Title with yellow highlight rectangle behind the text */}
        <div className="flex justify-center mt-6 sm:mt-12">
          <div className="relative inline-block">
            <div
              aria-hidden
              className="absolute"
              style={{ top: 8, bottom: 6, left: 8, right: 8, background: "#f6e921" }}
            />
            <h1
              className="relative font-medium px-4"
              style={{ fontSize: "clamp(30px, 5vw, 50px)", lineHeight: 1.1, color: "#000" }}
            >
              Submissions
            </h1>
          </div>
        </div>

        {/* Subtitle */}
        <p
          className="text-center mx-auto mt-6 sm:mt-8 px-2"
          style={{
            maxWidth: 720,
            fontSize: "clamp(18px, 2vw, 25px)",
            lineHeight: 1.35,
            color: "#000",
          }}
        >
          Thank you to the creators that have submitted &mdash; all of these ideas deserve to exist. Browse the submissions, find someone whose idea resonates with you, and show them some support.
        </p>

        {/* Sort dropdown */}
        <div className="max-w-6xl mx-auto mt-10 sm:mt-14 flex justify-end">
          <div ref={sortRef} className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-2 font-normal hover:opacity-70"
              style={{ fontSize: 20, color: "#000", lineHeight: 1 }}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
            >
              <span>Sort{sort !== "recent" ? `: ${SORT_LABELS[sort]}` : ""}</span>
              <svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden>
                <path d="M1 1l6 6 6-6" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {sortOpen && (
              <ul
                role="listbox"
                className="absolute right-0 mt-2 z-20 border border-black bg-white shadow-md"
                style={{ minWidth: 180 }}
              >
                {(["recent", "liked", "random"] as SortOption[]).map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => onPickSort(s)}
                      className="w-full text-left px-4 py-2 hover:bg-neutral-100"
                      style={{ fontSize: 18, color: "#000" }}
                    >
                      {SORT_LABELS[s]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Grid */}
        <div
          className="max-w-6xl mx-auto mt-6 grid gap-x-8 gap-y-12"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
        >
          {sorted.map((s) => (
            <SubmissionCard key={s.id} submission={s} />
          ))}
        </div>

        {/* Empty state */}
        {sorted.length === 0 && (
          <div className="max-w-md mx-auto mt-10 text-center" style={{ color: "#666", fontSize: 18 }}>
            <p>No submissions yet. Be the first to apply.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const thumb = youtubeThumbnail(submission.youtube_url);
  return (
    <div className="relative">
      {/* Corner brackets (decorative) */}
      <div aria-hidden className="absolute -top-3 -left-3 w-8 h-8 border-t-2 border-l-2 border-black border-dashed" />
      <div aria-hidden className="absolute -top-3 -right-3 w-8 h-8 border-t-2 border-r-2 border-black border-dashed" />

      <a
        href={submission.youtube_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative overflow-hidden bg-black aspect-video group"
      >
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        {/* Play triangle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
            <path d="M22 16 L48 32 L22 48 Z" fill="rgba(255,255,255,0.85)" />
          </svg>
        </div>
      </a>

      <div className="mt-4">
        <div className="font-medium" style={{ fontSize: 22, color: "#000", lineHeight: 1.2 }}>
          {submission.title}
        </div>
        <div className="mt-1" style={{ fontSize: 22, color: "#000", lineHeight: 1.2 }}>
          {submission.name}
        </div>
      </div>
    </div>
  );
}
