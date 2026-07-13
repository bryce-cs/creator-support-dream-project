"use client";

import { useEffect, useState } from "react";

const PASSWORD = "bigidea"; // compared case-insensitively
const STORAGE_KEY = "big-idea-fund-auth";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  // null = not yet checked (avoids a flash of the gate for already-authed users)
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setAuthed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim().toLowerCase() === PASSWORD) {
      window.localStorage.setItem(STORAGE_KEY, "1");
      setAuthed(true);
    } else {
      setError(true);
    }
  };

  // Still checking localStorage — render nothing (blank white) to avoid a flash.
  if (authed === null) return <div style={{ minHeight: "100vh", background: "#fff" }} />;

  if (authed) return <>{children}</>;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 320 }}>
        <label
          htmlFor="password"
          style={{ display: "block", fontSize: 18, fontWeight: 500, color: "#000", marginBottom: 12 }}
        >
          Enter Password:
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          style={{
            width: "100%",
            height: 44,
            padding: "0 12px",
            fontSize: 16,
            color: "#000",
            background: "#fff",
            border: `1px solid ${error ? "#eb1000" : "#000"}`,
            borderRadius: 8,
            outline: "none",
          }}
        />
        {error && (
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#eb1000" }}>
            Incorrect password.
          </p>
        )}
        <button
          type="submit"
          style={{
            width: "100%",
            height: 44,
            marginTop: 16,
            fontSize: 16,
            fontWeight: 500,
            color: "#fff",
            background: "#000",
            border: "1px solid #000",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Enter Site
        </button>
      </form>
    </div>
  );
}
