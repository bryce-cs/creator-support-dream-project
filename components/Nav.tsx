"use client";

import Link from "next/link";

interface NavProps {
  currentPath: "/" | "/submissions";
}

export default function Nav({ currentPath }: NavProps) {
  return (
    <header className="w-full px-5 sm:px-11 pt-8 pb-4 flex items-center justify-between">
      <div className="flex items-center gap-5 shrink-0">
        <Link href="/" className="block" style={{ width: 108, height: 38 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.svg" alt="Creator Support" className="w-full h-full" />
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/adobe-logo.png" alt="Adobe" className="block" style={{ height: 42, width: "auto", objectFit: "contain" }} />
      </div>
      <nav className="flex items-center gap-5">
        <Link
          href="/submissions"
          className="font-medium hover:opacity-70 hidden sm:inline-block whitespace-nowrap"
          style={{ fontSize: 20, color: "#000", lineHeight: 1, opacity: currentPath === "/submissions" ? 0.55 : 1 }}
          aria-current={currentPath === "/submissions" ? "page" : undefined}
        >
          View Submissions
        </Link>
        <Link
          href="#"
          className="font-medium hover:opacity-70 flex justify-center"
          style={{
            background: "#f6e921",
            paddingTop: 6,
            paddingBottom: 4,
            paddingLeft: 16,
            paddingRight: 16,
            fontSize: 20,
            color: "#000",
            lineHeight: 1,
          }}
        >
          Apply
        </Link>
      </nav>
    </header>
  );
}
