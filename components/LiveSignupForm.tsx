"use client";

import { useId, useState } from "react";

const YELLOW = "#f6e921";
const YELLOW_HOVER = "#fbf14d";

type Status = "idle" | "sending" | "done" | "error";

/**
 * Workshop signup. Posts to /api/subscribe, which forwards to Kit server-side
 * so the API key never reaches the browser.
 *
 * Two variants, both on /live and both writing to the same Kit form:
 *   - "dark": the row inside the black hero panel.
 *   - "light": the stacked form inside the bordered detail card.
 */
export default function LiveSignupForm({ variant }: { variant: "dark" | "light" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const id = useId();

  const dark = variant === "dark";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("done");
        setEmail("");
      } else {
        setStatus("error");
        setError(data.error || "Something went wrong. Try again in a moment.");
      }
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  if (status === "done") {
    return (
      <p
        role="status"
        className="m-0 rounded px-5 py-4 text-[17px] leading-snug font-semibold"
        style={{
          background: YELLOW,
          color: "#111111",
        }}
      >
        You&rsquo;re in. We&rsquo;ll email you the link before we go live.
      </p>
    );
  }

  const sending = status === "sending";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={dark ? "flex flex-wrap gap-2.5" : "flex flex-col gap-2.5"}
    >
      <label htmlFor={id} className="sr-only">
        Email address
      </label>
      <input
        id={id}
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={sending}
        aria-invalid={status === "error" || undefined}
        aria-describedby={status === "error" ? `${id}-error` : undefined}
        className={
          "h-[54px] min-w-0 rounded border bg-white px-[18px] text-base text-[#111111] outline-none placeholder:text-[#9a9a93] focus:ring-2 focus:ring-black/10 disabled:opacity-60" +
          (dark ? " flex-1 basis-[200px] border-[#34343a]" : " border-[#111111]")
        }
      />
      <button
        type="submit"
        disabled={sending}
        className={
          "h-[54px] cursor-pointer rounded border-none text-[17px] font-bold text-[#111111] transition-transform hover:-translate-y-px disabled:cursor-default disabled:opacity-70 disabled:hover:translate-y-0" +
          (dark ? " shrink-0 grow-0 px-[34px]" : " w-full")
        }
        style={{ background: sending ? YELLOW_HOVER : YELLOW }}
        onMouseEnter={(e) => (e.currentTarget.style.background = YELLOW_HOVER)}
        onMouseLeave={(e) => (e.currentTarget.style.background = sending ? YELLOW_HOVER : YELLOW)}
      >
        {sending ? "Signing up…" : "Sign Up"}
      </button>
      {status === "error" && (
        <p
          id={`${id}-error`}
          role="alert"
          className={
            "m-0 w-full text-sm font-medium" + (dark ? " text-[#ffb3a7]" : " text-[#eb1000]")
          }
        >
          {error}
        </p>
      )}
    </form>
  );
}
