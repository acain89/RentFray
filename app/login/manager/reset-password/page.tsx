"use client";
import { useEffect, useRef, useState } from "react";

export default function ResetPasswordPage() {
  const token = useRef("");
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const fragment = window.location.hash;
    window.history.replaceState(null, "", window.location.pathname);
    token.current = new URLSearchParams(fragment.slice(1)).get("token") ?? "";
    setReady(/^[a-f0-9]{64}$/.test(token.current));
    if (!/^[a-f0-9]{64}$/.test(token.current)) setMessage("This reset link is invalid or expired. Please request a new link.");
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy || !ready) return;
    if (password.trim() !== confirmation.trim() || password.trim().length < 8 || new TextEncoder().encode(password.trim()).length > 72) {
      setMessage("Enter matching passwords of at least 8 characters and at most 72 UTF-8 bytes."); return;
    }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/manager/password-recovery/reset", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current, password, confirmation }), cache: "no-store" });
      const body: unknown = await response.json();
      if (response.ok && body && typeof body === "object" && "redirectTo" in body && typeof body.redirectTo === "string" &&
          body.redirectTo.startsWith("/login/manager?code=")) {
        token.current = ""; window.location.assign(body.redirectTo); return;
      }
      setMessage(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Recovery is temporarily unavailable.");
    } catch { setMessage("Recovery is temporarily unavailable. Please try again later."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md p-6 space-y-4">
    <meta name="referrer" content="no-referrer" /><meta name="robots" content="noindex, nofollow" />
    <h1 className="text-2xl font-semibold">Reset password</h1>
    <form onSubmit={submit} className="space-y-4">
      <label className="block">New password<input type="password" className="block w-full rounded border p-3" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="block">Confirm password<input type="password" className="block w-full rounded border p-3" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      <button disabled={busy || !ready} className="w-full rounded bg-black p-3 text-white disabled:opacity-60">{busy ? "Saving..." : "Reset password"}</button>
    </form>
    <p role="status">{message}</p>
    {/* Full-document navigation prevents previously loaded analytics from observing reset tokens. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a href="/login/manager/forgot-password" className="underline">Request a new link</a>
  </main>;
}
