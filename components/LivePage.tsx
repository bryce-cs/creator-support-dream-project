import LiveSignupForm from "./LiveSignupForm";

/**
 * /live — landing page for the free YouTube workshop.
 *
 * Port of the "Big Idea Fund Workshop" design canvas. Unlike the homepage and
 * /terms (which scale a fixed Figma frame), this page is a fluid responsive
 * layout: the design is already expressed in clamp() and auto-fit grids, so it
 * reflows rather than scaling. It keeps the site's own logo lockup, brand
 * yellow (#f6e921) and system font stack instead of the mockup's stand-ins.
 *
 * Both signup forms write to the same Kit form — see lib/kit.ts.
 */

const YELLOW = "#f6e921";
const INK = "#111111";

const LEARN = [
  "The 2 questions we ask before any idea gets greenlit.",
  "Where high-viewership ideas actually come from.",
  "What makes an idea evergreen, repeatable, and visible enough to work.",
];

const WHEN = "Wednesday, Sept 16 @ 1p ET/10a PT";
const WHERE = "Free, Live Workshop on YouTube";
const TITLE = "How To Come Up With Ideas That Get Views";

export default function LivePage() {
  return (
    <div
      className="min-h-screen"
      style={{
        color: INK,
        backgroundColor: "#ffffff",
        // Dot grid from the design, drawn on the page rather than as an asset.
        backgroundImage: "radial-gradient(#d8d8d0 1.2px, transparent 1.2px)",
        backgroundSize: "34px 34px",
      }}
    >
      <header className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-x-7 gap-y-4 px-6 py-[26px]">
        <div className="flex items-center gap-[22px]">
          <a href="/" aria-label="Creator Support home" className="block hover:opacity-80">
            <img src="/assets/logo.svg" alt="Creator Support" className="h-11 w-[125px]" />
          </a>
          <img src="/assets/adobe-logo.png" alt="Adobe" className="h-[26px] w-auto" />
        </div>
        <a href="/" className="text-[15px] font-medium text-[#52524b] no-underline hover:opacity-70">
          The Big Idea Fund
        </a>
      </header>

      <main className="mx-auto flex max-w-[1160px] flex-col gap-[88px] px-6 pb-24">
        {/* Hero: photo beside the pitch and the primary signup. */}
        <section className="grid overflow-hidden rounded-md bg-[#17171a] [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          <div
            className="min-h-[260px] bg-cover sm:min-h-[420px]"
            style={{
              backgroundImage: "url('/assets/live-hero.webp')",
              backgroundPosition: "50% 32%",
            }}
            role="img"
            aria-label="Colin and Samir recording in the studio"
          />
          <div className="flex flex-col justify-center gap-[22px] p-[clamp(32px,5vw,60px)]">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="rounded px-[13px] py-[7px] text-sm font-bold"
                style={{ background: YELLOW, color: INK }}
              >
                {WHERE}
              </span>
              <span className="text-sm font-semibold" style={{ color: YELLOW }}>
                {WHEN}
              </span>
            </div>
            <h1 className="m-0 text-[clamp(34px,4.6vw,58px)] leading-[1.03] font-extrabold tracking-[-0.032em] text-balance text-white">
              {TITLE}
            </h1>
            <p className="m-0 max-w-[46ch] text-[clamp(16px,1.3vw,18px)] leading-normal text-pretty text-[#b9b9b2]">
              We&rsquo;re breaking down the exact framework we use to find ideas that actually get
              watched and then putting it into practice live on your video ideas.
            </p>
            <div className="mt-1.5">
              <LiveSignupForm variant="dark" />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-[34px]">
          <h2 className="m-0 text-[clamp(26px,2.8vw,34px)] font-extrabold tracking-[-0.025em]">
            What you&rsquo;ll learn:
          </h2>
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {LEARN.map((point, i) => (
              <article
                key={point}
                className="flex flex-col gap-[18px] rounded-md border border-[#111111] bg-white p-7"
              >
                <span
                  className="grid h-[38px] w-[38px] place-items-center rounded text-[17px] font-extrabold"
                  style={{ background: YELLOW }}
                >
                  {i + 1}
                </span>
                <p className="m-0 text-xl leading-[1.32] font-semibold tracking-[-0.015em] text-pretty">
                  {point}
                </p>
              </article>
            ))}
          </div>
          <p
            className="m-0 max-w-[78ch] rounded-md px-6 py-5 text-[17px] leading-normal text-pretty"
            style={{ background: YELLOW }}
          >
            <strong className="font-bold">Plus:</strong> we&rsquo;re rating submissions from the Big
            Idea Fund and auditing a few of your channels live, so you can see the framework applied
            in real time.
          </p>
        </section>

        {/* Second pass at the details, with the same signup for people who scrolled. */}
        <section className="grid items-center gap-10 rounded-md border border-[#111111] bg-white p-[clamp(30px,4.5vw,56px)] [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <div className="flex flex-col gap-6">
            <h2 className="m-0 text-[clamp(26px,3.2vw,38px)] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
              {TITLE}
            </h2>
            <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-[22px] gap-y-3.5">
              <dt className="text-base text-[#6b6b63]">When:</dt>
              <dd className="m-0 text-[17px] font-bold">{WHEN}</dd>
              <dt className="text-base text-[#6b6b63]">Where:</dt>
              <dd className="m-0">
                <span className="inline-block rounded bg-[#17171a] px-3 py-1.5 text-[15px] font-bold text-white">
                  {WHERE}
                </span>
              </dd>
            </dl>
          </div>
          <LiveSignupForm variant="light" />
        </section>
      </main>

      <footer className="mx-auto max-w-[1160px] px-6 pb-14 text-center text-[15px]">
        <a
          href="https://www.colinandsamir.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#52524b] underline underline-offset-[3px] hover:opacity-70"
        >
          Colin and Samir
        </a>
      </footer>
    </div>
  );
}
