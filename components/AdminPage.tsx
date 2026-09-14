"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FluidNav from "./FluidNav";
import type { Submission } from "@/lib/submissions";
import { youtubeThumbnail } from "@/lib/submissions";
import { OVERRIDABLE_FIELDS, type OverridableField, type Overrides } from "@/lib/overrides";
import {
  applyView,
  FIRST_DIR,
  formatSubscribers,
  isPicked,
  PICK_LABELS,
  PICK_LISTS,
  parseSubscriberBound,
  rowKey,
  toCsv,
  type LiveSubmission,
  type PickList,
  type SortDir,
  type SortKey,
  type YouTubeStats,
} from "@/lib/live-submissions";

const LABELS: Record<OverridableField, string> = {
  title: "Title",
  name: "Creator name",
  youtube_url: "YouTube link",
  profile_url: "Profile link",
  thumbnail_url: "Thumbnail image URL",
};

/** Field order in the card's two-column grid: title | name, then the links. */
const ORDER: OverridableField[] = ["title", "name", "youtube_url", "profile_url", "thumbnail_url"];

type RowState = Record<OverridableField, string> & { hidden: boolean };

function toRowState(s: Submission): RowState {
  return {
    title: s.title ?? "",
    name: s.name ?? "",
    youtube_url: s.youtube_url ?? "",
    profile_url: s.profile_url ?? "",
    thumbnail_url: s.thumbnail_url ?? "",
    hidden: Boolean(s.hidden),
  };
}

export type AdminTab = "ideas" | "channels";

export default function AdminPage({
  submissions,
  overrides,
  live,
  shortlist,
  initialTab,
}: {
  submissions: Submission[];
  overrides: Overrides;
  live: LiveSubmission[];
  shortlist: string[];
  initialTab: AdminTab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const visible = submissions.filter((s) => !s.hidden).length;

  // Idea shortlist. Ticks show instantly and save in the background; `ticked`
  // layers this page's ticks over the server's list, keyed by id so they hold
  // through the refresh that follows a Save on any card.
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [tickError, setTickError] = useState("");
  const onList = new Set(shortlist);
  const isShortlisted = (id: string) => (id in ticked ? ticked[id] : onList.has(id));
  const shortlistCount = submissions.filter((s) => isShortlisted(s.id)).length;
  const shownIdeas = shortlistOnly ? submissions.filter((s) => isShortlisted(s.id)) : submissions;

  const toggleShortlist = async (s: Submission, on: boolean) => {
    setTickError("");
    setTicked((t) => ({ ...t, [s.id]: on }));
    try {
      const res = await fetch("/api/admin/idea-shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, on }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
    } catch (err) {
      // Put the box back, so the page never shows a tick the server doesn't have.
      setTicked((t) => ({ ...t, [s.id]: !on }));
      setTickError(
        `Couldn't save the shortlist for "${s.title}"${err instanceof Error && err.message ? `: ${err.message}` : "."}`,
      );
    }
  };
  // Channel submissions now sit behind a tab, so their health signal has to
  // show on the tab itself or a broken Kit stretch goes unnoticed.
  const notInKit = live.filter((r) => r.kit !== "ok").length;

  const signOut = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.refresh();
  };

  // Mirror the tab into the URL so a reload, or a link to /admin?tab=channels,
  // lands on the same tab. replaceState, not push: switching tabs shouldn't
  // fill the back button with history entries.
  const choose = (next: AdminTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "ideas") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  // Short labels on phones: at full length the channel tab ran off-screen and
  // took its "didn't reach Kit" badge with it.
  const tabs: { id: AdminTab; label: string; short: string; count: number; alert?: number }[] = [
    { id: "ideas", label: "Idea submissions", short: "Ideas", count: submissions.length },
    { id: "channels", label: "Channel submissions", short: "Channels", count: live.length, alert: notInKit },
  ];

  // Arrow keys move between tabs, per the WAI-ARIA tabs pattern.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === tab);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id;
    choose(next);
    document.getElementById(`admin-tab-${next}`)?.focus();
  };

  return (
    <div className="min-h-screen bg-white">
      <FluidNav />
      <main className="px-5 sm:px-8 pb-24" style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div className="flex items-baseline justify-between flex-wrap" style={{ gap: 12, marginTop: 24 }}>
          <h1 className="font-medium" style={{ fontSize: 35, lineHeight: 1.2, color: "#000", margin: 0 }}>
            Admin
          </h1>
          <button type="button" onClick={signOut} className="hover:opacity-70"
            style={{ fontSize: 16, color: "#595959", textDecoration: "underline" }}>
            Sign out
          </button>
        </div>

        {/* One row at every width: wrapping put the inactive tab on a line of
            its own above the active one on phones. Short labels and smaller
            type below sm keep both on screen down to 320px. No overflow-x
            here — it forces overflow-y too, and the tabs' -1px overlap onto
            the rule then shows up as a stray scrollbar. */}
        <div role="tablist" aria-label="Submission type" onKeyDown={onKeyDown}
          className="flex"
          style={{ gap: 4, marginTop: 28, borderBottom: "1px solid #d1d1d1" }}>
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                id={`admin-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`admin-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => choose(t.id)}
                className={
                  "shrink-0 whitespace-nowrap px-2.5 py-2 text-[15px] sm:px-3.5 sm:py-2.5 sm:text-[18px]" +
                  (active ? "" : " hover:opacity-70")
                }
                style={{
                  fontWeight: active ? 600 : 400,
                  color: active ? "#000" : "#595959",
                  marginBottom: -1,
                  background: active ? "#f6e921" : "transparent",
                  border: "1px solid",
                  borderColor: active ? "#d1d1d1" : "transparent",
                  borderBottomColor: active ? "#f6e921" : "transparent",
                  borderRadius: "6px 6px 0 0",
                  cursor: "pointer",
                }}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="max-sm:hidden">{t.label}</span>{" "}
                <span style={{ color: active ? "#000" : "#9a9a9a" }}>({t.count})</span>
                {t.alert ? (
                  <span
                    title={`${t.alert} did not reach Kit`}
                    style={{
                      display: "inline-block",
                      marginLeft: 8,
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: "#eb1000",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      verticalAlign: "2px",
                    }}
                  >
                    {t.alert}
                    <span className="sr-only"> did not reach Kit</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div id="admin-panel-ideas" role="tabpanel" aria-labelledby="admin-tab-ideas" hidden={tab !== "ideas"}>
          <p style={{ fontSize: 17, color: "#555", margin: "20px 0 0", lineHeight: 1.45 }}>
            Submissions pull in from Typeform automatically. Editing a field here changes only what the
            site shows — the Typeform response is never modified, and any field you leave alone keeps
            tracking Typeform. {visible} of {submissions.length} showing publicly.
          </p>

          {submissions.length > 0 && (
            <div className="flex flex-wrap items-center" style={{ gap: "8px 14px", marginTop: 20, fontSize: 15 }}>
              <label className="flex items-center" style={{ gap: 7, cursor: "pointer", color: "#000", fontWeight: 600 }}>
                <input type="checkbox" checked={shortlistOnly}
                  onChange={(e) => setShortlistOnly(e.target.checked)} style={checkboxStyle} />
                Shortlist only <span style={{ fontWeight: 400, color: "#666" }}>({shortlistCount})</span>
              </label>
              {shortlistOnly && (
                <span style={{ color: "#666" }}>Showing {shownIdeas.length} of {submissions.length}</span>
              )}
            </div>
          )}
          {tickError && (
            <p role="alert" style={{ margin: "8px 0 0", color: "#eb1000", fontSize: 14 }}>{tickError}</p>
          )}

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {shownIdeas.map((s) => (
              <Row key={s.id} submission={s} override={overrides[s.id]} onSaved={() => router.refresh()}
                shortlisted={isShortlisted(s.id)} onShortlist={(on) => toggleShortlist(s, on)} />
            ))}
          </div>

          {shortlistOnly && shownIdeas.length === 0 && submissions.length > 0 && (
            <p style={{ marginTop: 16, color: "#666", fontSize: 16 }}>
              Nobody&rsquo;s on the shortlist yet. Tick Shortlist on a card to add it.
            </p>
          )}

          {submissions.length === 0 && (
            <p style={{ marginTop: 40, color: "#666", fontSize: 18 }}>
              No submissions yet. If you expected some, check that TYPEFORM_TOKEN is set.
            </p>
          )}
        </div>

        <div id="admin-panel-channels" role="tabpanel" aria-labelledby="admin-tab-channels" hidden={tab !== "channels"}>
          <LiveSubmissions rows={live} />
        </div>
      </main>
    </div>
  );
}

/**
 * One idea submission, laid out to take as little height as possible: the
 * thumbnail and status on the left, a two-column grid of fields on the right
 * (title | creator name, YouTube | profile link, thumbnail URL | hide + save).
 * Labels are small and sit above each box so nothing needs a line of its own.
 */
function Row({
  submission,
  override,
  onSaved,
  shortlisted,
  onShortlist,
}: {
  submission: Submission;
  override?: Overrides[string];
  onSaved: () => void;
  shortlisted: boolean;
  onShortlist: (on: boolean) => void;
}) {
  const [state, setState] = useState<RowState>(() => toRowState(submission));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const initial = toRowState(submission);
  const dirty =
    ORDER.some((f) => state[f] !== initial[f]) || state.hidden !== initial.hidden;
  const byTag = submission.hidden_reason === "tag";

  const send = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submission.id, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error || "Save failed.");
        return;
      }
      setStatus(done);
      onSaved();
    } catch {
      setStatus("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    send(
      { fields: { ...Object.fromEntries(ORDER.map((f) => [f, state[f]])), hidden: state.hidden } },
      "Saved.",
    );

  const reset = () => {
    setState(toRowState({ ...submission }));
    send({ reset: true }, "Reset to Typeform.");
  };

  const thumb = state.thumbnail_url || youtubeThumbnail(state.youtube_url) || "";

  const field = (f: OverridableField) => (
    <div key={f} style={{ minWidth: 0 }}>
      <label htmlFor={`${submission.id}-${f}`} className="flex items-center"
        style={{ fontSize: 12, color: "#666", gap: 5, lineHeight: 1.2 }}>
        {LABELS[f]}
        {override && f in override && <Badge small>edited</Badge>}
      </label>
      <input
        id={`${submission.id}-${f}`}
        value={state[f]}
        onChange={(e) => setState((p) => ({ ...p, [f]: e.target.value }))}
        className="w-full"
        style={{
          marginTop: 3,
          padding: "5px 8px",
          fontSize: 15,
          border: "1px solid #bbb",
          background: "#fff",
          color: "#000",
        }}
      />
    </div>
  );

  return (
    <section
      style={{
        border: "1px solid #000",
        padding: 12,
        background: shortlisted ? "#fdfbe0" : submission.hidden ? "#fafafa" : "#fff",
        opacity: submission.hidden ? 0.85 : 1,
      }}
    >
      <div className="flex flex-col sm:flex-row" style={{ gap: 14 }}>
        <div style={{ flex: "0 0 auto", width: 128 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            style={{ width: 128, height: 72, objectFit: "cover", background: "#000", display: "block" }}
          />
          <label className="flex items-center"
            style={{ marginTop: 8, gap: 6, fontSize: 14, fontWeight: 600, color: "#000", cursor: "pointer" }}>
            <input type="checkbox" checked={shortlisted}
              onChange={(e) => onShortlist(e.target.checked)} style={checkboxStyle} />
            Shortlist
          </label>
          <div className="flex flex-wrap" style={{ marginTop: 6, gap: 4 }}>
            {override && <Badge small>edited</Badge>}
            {submission.hidden && <Badge small tone="hidden">{byTag ? "hidden by tag" : "hidden"}</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2"
          style={{ flex: "1 1 auto", minWidth: 0, gap: "8px 12px", alignContent: "start" }}>
          {ORDER.map(field)}

          {/* Last cell pairs with the thumbnail URL: hide, then save controls. */}
          <div className="flex flex-col justify-end" style={{ gap: 6, minWidth: 0 }}>
            <label className="flex items-center" style={{ fontSize: 14, color: "#000", gap: 7 }}
              title={byTag ? "Remove the Typeform tag to unhide" : undefined}>
              <input
                type="checkbox"
                checked={state.hidden}
                disabled={byTag}
                onChange={(e) => setState((p) => ({ ...p, hidden: e.target.checked }))}
                style={checkboxStyle}
              />
              Hide from public page
              {byTag && <span style={{ fontSize: 12, color: "#777" }}>(Typeform tag)</span>}
            </label>
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                onClick={save}
                disabled={busy || !dirty}
                className="hover:brightness-95 transition-[filter] disabled:opacity-40"
                style={{
                  padding: "4px 16px",
                  fontSize: 15,
                  background: "#f6e921",
                  border: "1px solid #000",
                  color: "#000",
                }}
              >
                {busy ? "Saving…" : "Save"}
              </button>
              {override && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy}
                  className="hover:opacity-70 disabled:opacity-40"
                  style={{ fontSize: 14, color: "#595959", textDecoration: "underline" }}
                >
                  Reset to Typeform
                </button>
              )}
              {status && <span style={{ fontSize: 13, color: "#555" }}>{status}</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Badge({
  children,
  tone,
  small,
}: {
  children: React.ReactNode;
  tone?: "hidden";
  small?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: small ? 12 : 13,
        padding: small ? "1px 6px" : "2px 8px",
        background: tone === "hidden" ? "#eee" : "#f6e921",
        border: "1px solid #000",
        color: "#000",
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Channel submissions from /live, read from our own file rather than from Kit.
 *
 * Deliberately plain: this exists so the list survives a day when Kit is the
 * thing that's broken, so it must not depend on Kit being reachable. The Kit
 * column is the health signal — a run of "failed" means the site kept the
 * submissions but Kit didn't.
 */
function LiveSubmissions({ rows }: { rows: LiveSubmission[] }) {
  const router = useRouter();
  const problems = rows.filter((r) => r.kit !== "ok").length;
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [checkError, setCheckError] = useState("");

  // Sorting and the subscriber window. Client-side only: the list is small, and
  // it keeps the view put across the refresh after a subscriber check.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "at", dir: "desc" });
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const min = parseSubscriberBound(minText);
  const max = parseSubscriberBound(maxText);
  // Lists being filtered to (Live, Show). Any ticked = on at least one of them.
  const [listFilter, setListFilter] = useState<PickList[]>([]);

  // Ticks show instantly and save in the background. `ticked` holds the ones
  // made on this page, layered over what the server sent, and survives the
  // refresh after a subscriber check because it's keyed by row, not position.
  const [ticked, setTicked] = useState<Record<string, Partial<Record<PickList, boolean>>>>({});
  const [tickError, setTickError] = useState("");
  const all = rows.map((r) => {
    const local = ticked[rowKey(r)];
    if (!local) return r;
    const picks = { ...r.picks };
    for (const l of PICK_LISTS) {
      if (local[l] === true) picks[l] = true;
      else if (local[l] === false) delete picks[l];
    }
    return { ...r, picks };
  });
  const counts = Object.fromEntries(
    PICK_LISTS.map((l) => [l, all.filter((r) => isPicked(r, l)).length]),
  ) as Record<PickList, number>;

  const togglePick = async (r: LiveSubmission, list: PickList, on: boolean) => {
    const k = rowKey(r);
    const set = (v: boolean) => setTicked((t) => ({ ...t, [k]: { ...t[k], [list]: v } }));
    setTickError("");
    set(on);
    try {
      const res = await fetch("/api/admin/live-submissions/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: k, list, on }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
    } catch (err) {
      // Put the box back, so the page never shows a tick the server doesn't have.
      set(!on);
      setTickError(
        `Couldn't save ${PICK_LABELS[list]} for ${r.email}${err instanceof Error && err.message ? `: ${err.message}` : "."}`,
      );
    }
  };

  const filtering =
    listFilter.length > 0 ||
    (min !== null && min !== "invalid") ||
    (max !== null && max !== "invalid");
  const shown = applyView(all, {
    sort,
    // An unreadable bound is flagged on the input and otherwise ignored.
    min: min === "invalid" ? null : min,
    max: max === "invalid" ? null : max,
    lists: listFilter,
  });

  // A new column starts in its natural direction; the active one flips.
  const sortBy = (key: SortKey) =>
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: FIRST_DIR[key] },
    );

  // The route checks one batch per call and says how many are left, so loop
  // until it's done. `since` comes from the server's first reply and marks the
  // run: anything checked before it is due again, so this is a full refresh.
  const checkSubscribers = async () => {
    setCheckError("");
    setProgress({ done: 0, total: rows.length });
    let since: string | undefined;
    let done = 0;
    try {
      for (;;) {
        const res = await fetch("/api/admin/live-submissions/subscribers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ since }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCheckError(data.error || `Subscriber check failed (${res.status}).`);
          break;
        }
        since = data.since;
        done += data.checked;
        setProgress({ done, total: done + data.remaining });
        // checked === 0 is a guard: never spin on a batch that makes no progress.
        if (data.remaining === 0 || data.checked === 0) break;
      }
    } catch {
      setCheckError("Couldn't reach the server. Anything already checked was saved.");
    }
    setProgress(null);
    router.refresh();
  };

  // With a window set, export exactly what's on screen — and say so on the
  // button, so a filtered file is never mistaken for the full backup.
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([toCsv(filtering ? shown : applyView(all, { sort, min: null, max: null }))], {
        type: "text/csv",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `live-submissions-${filtering ? "filtered-" : ""}${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <div className="flex flex-col items-start sm:flex-row sm:justify-between" style={{ gap: 12, marginTop: 20 }}>
        <p style={{ fontSize: 17, color: "#555", margin: 0, lineHeight: 1.45 }}>
          Everything submitted through <a href="/live" style={{ color: "#555" }}>/live</a>, saved on
          this server as it arrives. This copy is written whether or not Kit accepts it, so it stays
          complete even if Kit breaks.
          {problems > 0 && (
            <>
              {" "}
              <strong style={{ color: "#eb1000" }}>
                {problems} {problems === 1 ? "submission" : "submissions"} did not reach Kit
              </strong>{" "}
              — they're tagged below and will need adding by hand.
            </>
          )}
        </p>
        {rows.length > 0 && (
          <div className="flex shrink-0 items-baseline" style={{ gap: 18 }}>
            <button type="button" onClick={checkSubscribers} disabled={progress !== null}
              className="hover:opacity-70 disabled:opacity-100 disabled:cursor-default"
              style={{ fontSize: 16, color: "#595959", textDecoration: "underline", whiteSpace: "nowrap" }}>
              {progress
                ? `Checking… ${progress.done} of ${progress.total}`
                : "Check subscriber counts"}
            </button>
            <button type="button" onClick={download} className="hover:opacity-70"
              style={{ fontSize: 16, color: "#595959", textDecoration: "underline", whiteSpace: "nowrap" }}>
              {filtering ? `Download ${shown.length} shown` : "Download CSV"}
            </button>
          </div>
        )}
      </div>

      {checkError && (
        <p role="alert" style={{ margin: "12px 0 0", color: "#eb1000", fontSize: 15 }}>
          {checkError}
        </p>
      )}

      {rows.length === 0 ? (
        <p style={{ marginTop: 20, color: "#666", fontSize: 18 }}>
          Nothing submitted yet.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center" style={{ gap: "10px 14px", marginTop: 20, fontSize: 15 }}>
            {PICK_LISTS.map((l) => (
              <label key={l} className="flex items-center"
                style={{ gap: 7, cursor: "pointer", color: "#000", fontWeight: 600 }}>
                <input type="checkbox" checked={listFilter.includes(l)}
                  onChange={(e) =>
                    setListFilter((cur) =>
                      e.target.checked ? [...cur, l] : cur.filter((x) => x !== l),
                    )
                  }
                  style={checkboxStyle} />
                {PICK_LABELS[l]} <span style={{ fontWeight: 400, color: "#666" }}>({counts[l]})</span>
              </label>
            ))}
            <span aria-hidden="true" style={{ color: "#d1d1d1" }}>|</span>
            <span style={{ fontWeight: 600, color: "#000" }}>Subscribers</span>
            {/* Kept as one unit so "max" never wraps away from "to" on a phone. */}
            <span className="flex items-center" style={{ gap: 10 }}>
              <BoundInput label="Minimum subscribers" placeholder="min, e.g. 10k"
                value={minText} onChange={setMinText} invalid={min === "invalid"} />
              <span style={{ color: "#666" }}>to</span>
              <BoundInput label="Maximum subscribers" placeholder="max, e.g. 1M"
                value={maxText} onChange={setMaxText} invalid={max === "invalid"} />
            </span>
            {(minText || maxText || listFilter.length > 0) && (
              <button type="button"
                onClick={() => { setMinText(""); setMaxText(""); setListFilter([]); }}
                className="hover:opacity-70"
                style={{ color: "#595959", textDecoration: "underline" }}>
                Clear
              </button>
            )}
            {filtering && (
              <span style={{ color: "#666" }}>
                Showing {shown.length} of {rows.length}
                {(min !== null && min !== "invalid") || (max !== null && max !== "invalid")
                  ? " — rows without a count are hidden"
                  : ""}
              </span>
            )}
          </div>
          {tickError && (
            <p role="alert" style={{ margin: "8px 0 0", color: "#eb1000", fontSize: 14 }}>
              {tickError}
            </p>
          )}
          {(min === "invalid" || max === "invalid") && (
            <p role="alert" style={{ margin: "8px 0 0", color: "#eb1000", fontSize: 14 }}>
              Use a number like 50000, 50k or 1.5M.
            </p>
          )}

          <div style={{ marginTop: 16, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 15 }}>
              <thead>
                <tr>
                  {PICK_LISTS.map((l) => (
                    <th key={l} style={{ ...thStyle, width: 1, paddingRight: 14, textAlign: "center" }}>
                      {PICK_LABELS[l]}
                    </th>
                  ))}
                  <SortHeader label="Submitted" col="at" sort={sort} onSort={sortBy}
                    hints={{ asc: "Oldest first", desc: "Newest first" }} />
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Channel</th>
                  <SortHeader label="Subscribers" col="subscribers" sort={sort} onSort={sortBy}
                    hints={{ asc: "Lowest first", desc: "Highest first" }} />
                  <th style={thStyle}>Biggest challenge</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={rowKey(r)}
                    style={PICK_LISTS.some((l) => isPicked(r, l)) ? { background: "#fdfbe0" } : undefined}>
                    {PICK_LISTS.map((l) => (
                      <td key={l} style={{ ...cellStyle, paddingRight: 14, textAlign: "center" }}>
                        <input type="checkbox" checked={isPicked(r, l)}
                          onChange={(e) => togglePick(r, l, e.target.checked)}
                          aria-label={`${PICK_LABELS[l]}: ${r.email}`}
                          style={checkboxStyle} />
                      </td>
                    ))}
                    <td style={{ ...cellStyle, whiteSpace: "nowrap", color: "#666" }}>
                      {formatWhen(r.at)}
                    </td>
                    <td style={cellStyle}>
                      {r.email}
                      {r.kit !== "ok" && (
                        <span
                          title={r.kit === "not-configured"
                            ? "Kit wasn't set up when this came in — add them to Kit by hand"
                            : "Kit rejected this one — add them to Kit by hand"}
                          style={{ display: "block", fontSize: 12, color: "#eb1000" }}>
                          not in Kit
                        </span>
                      )}
                    </td>
                    <td style={{ ...cellStyle, maxWidth: 260, overflowWrap: "anywhere" }}>
                      <a href={toHref(r.channel)} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#000" }}>
                        {r.channel}
                      </a>
                    </td>
                    <td style={{ ...cellStyle, minWidth: 150 }}>
                      <SubscriberCell stats={r.youtube} />
                    </td>
                    <td style={{ ...cellStyle, minWidth: 220 }}>{r.problem || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && (
              <p style={{ marginTop: 16, color: "#666", fontSize: 16 }}>
                {listFilter.length > 0 && listFilter.every((l) => counts[l] === 0)
                  ? `Nobody's ticked for ${listFilter.map((l) => PICK_LABELS[l]).join(" or ")} yet.`
                  : "No submissions match these filters."}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * A clickable column header. aria-sort sits on the <th> so screen readers
 * announce the order; the button inside does the toggling.
 */
function SortHeader({
  label,
  col,
  sort,
  onSort,
  hints,
}: {
  label: string;
  col: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (col: SortKey) => void;
  hints: Record<SortDir, string>;
}) {
  const active = sort.key === col;
  const next: SortDir = active ? (sort.dir === "asc" ? "desc" : "asc") : FIRST_DIR[col];
  return (
    <th style={thStyle} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(col)} className="hover:opacity-70"
        title={`${active ? `${hints[sort.dir]}. ` : ""}Click for ${hints[next].toLowerCase()}`}
        style={{ font: "inherit", color: "inherit", fontWeight: 600, cursor: "pointer",
          display: "inline-flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
        {label}
        <span aria-hidden="true" style={{ fontSize: 12, color: active ? "#000" : "#bbb" }}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function BoundInput({
  label,
  placeholder,
  value,
  onChange,
  invalid,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 120,
        height: 34,
        padding: "0 10px",
        border: `1px solid ${invalid ? "#eb1000" : "#b5b5b5"}`,
        borderRadius: 4,
        fontSize: 15,
        color: "#000",
      }}
    />
  );
}

/**
 * The count, with the channel it resolved to underneath — a handle can resolve
 * somewhere unexpected, and the name is how you'd notice.
 */
function SubscriberCell({ stats }: { stats?: YouTubeStats }) {
  const muted = { color: "#9a9a9a" };
  if (!stats) return <span style={muted} title="Not checked yet">—</span>;

  switch (stats.status) {
    case "not-youtube":
      return <span style={muted} title="Not a YouTube link">not YouTube</span>;
    case "not-found":
      return <span style={muted} title="No YouTube channel found at this link">not found</span>;
    case "error":
      return <span style={{ color: "#eb1000" }} title={stats.error}>error</span>;
  }

  const channelUrl = stats.channelId ? `https://www.youtube.com/channel/${stats.channelId}` : undefined;
  return (
    <div style={{ lineHeight: 1.3 }}>
      <span
        style={{ fontWeight: 600, color: "#000" }}
        title={stats.subscribers != null ? `${stats.subscribers.toLocaleString()} subscribers` : undefined}
      >
        {stats.subscribers != null ? formatSubscribers(stats.subscribers) : "hidden"}
      </span>
      {stats.matchedBySearch && (
        <span
          style={{ marginLeft: 6, fontSize: 12, color: "#b35c00", whiteSpace: "nowrap" }}
          title="Found by searching the name, not an exact link — check it's the right channel"
        >
          search match
        </span>
      )}
      {stats.title && (
        <a href={channelUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: "block", fontSize: 13, color: "#666", textDecoration: "none" }}>
          {stats.title}
        </a>
      )}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  borderBottom: "1px solid #d1d1d1",
  padding: "10px 12px 10px 0",
  verticalAlign: "top",
  lineHeight: 1.4,
};

/** Native checkbox, sized up and in the brand ink so it reads at a glance. */
const checkboxStyle: React.CSSProperties = {
  width: 17,
  height: 17,
  accentColor: "#000",
  cursor: "pointer",
  verticalAlign: "middle",
};

const thStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: "left",
  fontWeight: 600,
  color: "#000",
  verticalAlign: "bottom",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** People paste bare handles and bare domains; make both clickable. */
function toHref(channel: string): string {
  if (/^https?:\/\//i.test(channel)) return channel;
  if (channel.startsWith("@")) return `https://www.youtube.com/${channel}`;
  return `https://${channel}`;
}
