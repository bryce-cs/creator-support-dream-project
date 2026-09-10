"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FluidNav from "./FluidNav";
import type { Submission } from "@/lib/submissions";
import { youtubeThumbnail } from "@/lib/submissions";
import { OVERRIDABLE_FIELDS, type OverridableField, type Overrides } from "@/lib/overrides";
import {
  formatSubscribers,
  toCsv,
  type LiveSubmission,
  type YouTubeStats,
} from "@/lib/live-submissions";

const LABELS: Record<OverridableField, string> = {
  title: "Title",
  name: "Creator name",
  youtube_url: "YouTube link",
  profile_url: "Profile link",
  thumbnail_url: "Thumbnail image URL",
};

/** Longer values get a taller box; links are single-line. */
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
  initialTab,
}: {
  submissions: Submission[];
  overrides: Overrides;
  live: LiveSubmission[];
  initialTab: AdminTab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const visible = submissions.filter((s) => !s.hidden).length;
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

          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            {submissions.map((s) => (
              <Row key={s.id} submission={s} override={overrides[s.id]} onSaved={() => router.refresh()} />
            ))}
          </div>

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

function Row({
  submission,
  override,
  onSaved,
}: {
  submission: Submission;
  override?: Overrides[string];
  onSaved: () => void;
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

  return (
    <section
      style={{
        border: "1px solid #000",
        padding: 16,
        background: submission.hidden ? "#fafafa" : "#fff",
        opacity: submission.hidden ? 0.85 : 1,
      }}
    >
      <div className="flex flex-wrap" style={{ gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt=""
          style={{ width: 160, height: 90, objectFit: "cover", background: "#000", flex: "0 0 auto" }}
        />
        <div style={{ flex: "1 1 320px", minWidth: 260 }}>
          <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
            <code style={{ fontSize: 13, color: "#777" }}>{submission.id}</code>
            {override && <Badge>edited</Badge>}
            {submission.hidden && <Badge tone="hidden">{byTag ? "hidden by tag" : "hidden"}</Badge>}
          </div>

          {ORDER.map((field) => (
            <div key={field} style={{ marginTop: 10 }}>
              <label
                htmlFor={`${submission.id}-${field}`}
                className="flex items-center"
                style={{ fontSize: 14, color: "#555", gap: 6 }}
              >
                {LABELS[field]}
                {override && field in override && <Badge small>edited</Badge>}
              </label>
              <input
                id={`${submission.id}-${field}`}
                value={state[field]}
                onChange={(e) => setState((p) => ({ ...p, [field]: e.target.value }))}
                className="w-full"
                style={{
                  marginTop: 4,
                  padding: "7px 10px",
                  fontSize: 16,
                  border: "1px solid #bbb",
                  background: "#fff",
                  color: "#000",
                }}
              />
            </div>
          ))}

          <label
            className="flex items-center"
            style={{ marginTop: 14, fontSize: 16, color: "#000", gap: 8 }}
          >
            <input
              type="checkbox"
              checked={state.hidden}
              disabled={byTag}
              onChange={(e) => setState((p) => ({ ...p, hidden: e.target.checked }))}
            />
            Hide from the public page
            {byTag && (
              <span style={{ fontSize: 14, color: "#777" }}>
                — remove the Typeform tag to unhide
              </span>
            )}
          </label>

          <div className="flex items-center flex-wrap" style={{ marginTop: 14, gap: 12 }}>
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="hover:brightness-95 transition-[filter] disabled:opacity-40"
              style={{
                padding: "8px 20px",
                fontSize: 17,
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
                style={{ fontSize: 16, color: "#595959", textDecoration: "underline" }}
              >
                Reset to Typeform
              </button>
            )}
            {status && <span style={{ fontSize: 15, color: "#555" }}>{status}</span>}
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

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `live-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
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
              — they are listed below and will need adding by hand.
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
              Download CSV
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
        <div style={{ marginTop: 20, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 15 }}>
            <thead>
              <tr>
                {["Submitted", "Email", "Channel", "Subscribers", "Biggest challenge", "Kit"].map((h) => (
                  <th key={h} style={{ ...cellStyle, textAlign: "left", fontWeight: 600, color: "#000" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.at}-${i}`}>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap", color: "#666" }}>
                    {formatWhen(r.at)}
                  </td>
                  <td style={cellStyle}>{r.email}</td>
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
                  <td style={{ ...cellStyle, color: r.kit === "ok" ? "#666" : "#eb1000" }}>
                    {r.kit === "ok" ? "ok" : r.kit === "not-configured" ? "not set up" : "failed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
