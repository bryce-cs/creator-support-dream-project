"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FluidNav from "./FluidNav";
import type { Submission } from "@/lib/submissions";
import { youtubeThumbnail } from "@/lib/submissions";
import { OVERRIDABLE_FIELDS, type OverridableField, type Overrides } from "@/lib/overrides";

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

export default function AdminPage({
  submissions,
  overrides,
}: {
  submissions: Submission[];
  overrides: Overrides;
}) {
  const router = useRouter();
  const visible = submissions.filter((s) => !s.hidden).length;

  const signOut = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.refresh();
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

        <p style={{ fontSize: 17, color: "#555", margin: "12px 0 0", lineHeight: 1.45 }}>
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
