import FluidNav from "./FluidNav";
import { TERMS_BLOCKS, type Block, type Run } from "@/lib/terms-content";

/**
 * Terms & Conditions page — a 1:1 port of the "Desktop - 17" frame in Figma
 * (Creator-Startup, node 5209-13).
 *
 * Everything is expressed as a ratio of the Figma frame so the page matches the
 * design at 1440px and scales down proportionally instead of reflowing:
 *
 *   - Content column: 900px inside a 1440px frame (270px gutters).
 *   - Type scale derives from one base size (--tfs = 16px at desktop) so the
 *     16 / 18 / 20 / 30 / 50px ramp in the Figma is preserved exactly.
 *   - Hanging indents are percentages of the 900px column: level 1 indents
 *     42/900, level 2 indents 92/900, and each number column is 50/900 or
 *     46/900. A `max(%, em)` floor keeps "12.1" and "(A)" from wrapping on
 *     narrow screens where the raw percentage would be too tight.
 *
 * Copy comes from lib/terms-content.ts and must not be edited here.
 */

const COLUMN = 900;
const pct = (px: number) => `${((px / COLUMN) * 100).toFixed(4)}%`;

// Font sizes as multiples of the base body size (16px in the Figma).
const FS = {
  base: "var(--tfs)",
  h0: "calc(var(--tfs) * 1.125)", // 18
  banner: "calc(var(--tfs) * 1.25)", // 20
  heading: "calc(var(--tfs) * 1.875)", // 30
  hero: "calc(var(--tfs) * 3.125)", // 50
  cell: "calc(var(--tfs) * 0.9375)", // 15
  footer: "calc(var(--tfs) * 1.25)", // 20
};

// Per-level indent, number-column width, spacing above, and line height.
// Values in px are Figma measurements at the 900px column width.
const LEVEL = {
  h0: { indent: 0, numW: `max(${pct(42)}, 2.5em)`, fs: FS.h0, mt: "1.4444em", lh: 1.45 },
  n1: { indent: pct(42), numW: `max(${pct(50)}, 3em)`, fs: FS.base, mt: "1.125em", lh: 1.52 },
  n2: { indent: pct(92), numW: `max(${pct(46)}, 2.7em)`, fs: FS.base, mt: "0.875em", lh: 1.52 },
  body: { indent: pct(92), numW: "0", fs: FS.base, mt: "0.875em", lh: 1.52 },
} as const;

const BORDER = "#d1d1d1";
// Column widths inside the schedule table, as a share of the 808px grid.
const TABLE_COLS = [196, 180, 180, 252].map((w) => `${((w / 808) * 100).toFixed(4)}%`);

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) => (
        <span
          key={i}
          style={{
            fontWeight: r.b ? 600 : undefined,
            fontStyle: r.i ? "italic" : undefined,
            textDecoration: r.u ? "underline" : undefined,
          }}
        >
          {r.t}
        </span>
      ))}
    </>
  );
}

/** A numbered clause rendered as a hanging indent: [gutter][number][text]. */
function Clause({
  level,
  num,
  runs,
  just,
}: {
  level: keyof typeof LEVEL;
  num?: string;
  runs: Run[];
  just?: boolean;
}) {
  const L = LEVEL[level];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        fontSize: L.fs,
        lineHeight: L.lh,
        marginTop: L.mt,
      }}
    >
      {L.indent !== 0 && <div aria-hidden style={{ flex: `0 0 ${L.indent}` }} />}
      {num && (
        <div style={{ flex: `0 0 ${L.numW}`, fontWeight: 600 }}>{num}</div>
      )}
      {/* .terms-justify justifies like the Figma, but only above the phone
          breakpoint — see app/globals.css. */}
      <div className={just ? "terms-justify" : undefined} style={{ flex: "1 1 auto", minWidth: 0 }}>
        <Runs runs={runs} />
      </div>
    </div>
  );
}

function ScheduleTable({ rows }: { rows: string[][] }) {
  return (
    <div style={{ display: "flex", marginTop: "1.25em" }}>
      <div aria-hidden style={{ flex: `0 0 ${pct(92)}` }} />
      {/* Scrolls horizontally rather than crushing the four columns on phones. */}
      <div style={{ flex: "1 1 auto", minWidth: 0, overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 460,
            borderCollapse: "collapse",
            fontSize: FS.cell,
            lineHeight: 1.45,
            border: `1px solid ${BORDER}`,
          }}
        >
          <colgroup>
            {TABLE_COLS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      border: `1px solid ${BORDER}`,
                      padding: "10px 14px",
                      verticalAlign: "top",
                      whiteSpace: "nowrap",
                      fontWeight: ri === 0 || ci === 0 ? 600 : 400,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "title":
            return (
              <h2
                key={i}
                style={{
                  margin: "0 0 1.2em",
                  textAlign: "center",
                  fontSize: FS.heading,
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                <Runs runs={b.runs} />
              </h2>
            );
          case "banner":
            return (
              <h3
                key={i}
                style={{
                  margin: "2.6em 0 0.5em",
                  fontSize: FS.banner,
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                <Runs runs={b.runs} />
              </h3>
            );
          case "table":
            return <ScheduleTable key={i} rows={b.rows} />;
          case "body":
            return <Clause key={i} level="body" runs={b.runs} />;
          default:
            return <Clause key={i} level={b.type} num={b.num} runs={b.runs} just={b.just} />;
        }
      })}
    </>
  );
}

export default function TermsPage() {
  return (
    <div
      className="min-h-screen bg-white"
      style={{
        backgroundImage: "radial-gradient(circle, #9a9a9a 1.1px, transparent 1.3px)",
        backgroundSize: "52px 52px",
        backgroundPosition: "26px 67px",
      }}
    >
      <FluidNav />

      <main
        style={
          {
            "--tfs": "clamp(14px, 1.12vw, 16px)",
            maxWidth: COLUMN,
            margin: "0 auto",
            padding: "0 20px 80px",
            color: "#000",
          } as React.CSSProperties
        }
      >
        <h1
          style={{
            margin: "0.6em 0 0",
            textAlign: "center",
            fontSize: FS.hero,
            fontWeight: 500,
            lineHeight: 1.2,
          }}
        >
          Terms &amp; Conditions
        </h1>

        <p
          style={{
            margin: "0.55em 0 2.4em",
            textAlign: "center",
            fontSize: FS.heading,
            lineHeight: 1.15,
          }}
        >
          THE BIG IDEA CONTEST
          <br />
          (A Skill-Based Contest)
        </p>

        <Blocks blocks={TERMS_BLOCKS} />

        <div style={{ marginTop: "7em", textAlign: "center" }}>
          <a
            href="https://www.colinandsamir.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70"
            style={{ fontSize: FS.footer, color: "#595959", textDecoration: "underline" }}
          >
            Colin and Samir
          </a>
        </div>
      </main>
    </div>
  );
}
