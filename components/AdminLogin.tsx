"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FluidNav from "./FluidNav";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword("");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Sign in failed.");
    } catch {
      setError("Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <FluidNav />
      <main className="px-5 pb-24 flex justify-center">
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, marginTop: 60 }}>
          <h1 className="font-medium" style={{ fontSize: 35, lineHeight: 1.2, color: "#000", margin: 0 }}>
            Admin
          </h1>
          <p style={{ fontSize: 18, color: "#555", margin: "12px 0 24px", lineHeight: 1.4 }}>
            Edit how submissions appear on the site.
          </p>
          <label htmlFor="admin-password" style={{ fontSize: 18, color: "#000" }}>
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
            style={{
              marginTop: 8,
              padding: "10px 12px",
              fontSize: 18,
              border: "1px solid #000",
              background: "#fff",
              color: "#000",
            }}
          />
          {error && (
            <p role="alert" style={{ color: "#eb1000", fontSize: 16, margin: "12px 0 0" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full hover:brightness-95 transition-[filter] disabled:opacity-50"
            style={{
              marginTop: 20,
              padding: "12px 0",
              fontSize: 20,
              background: "#f6e921",
              border: "1px solid #000",
              color: "#000",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
