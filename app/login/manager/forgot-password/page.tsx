"use client";
import { useEffect, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [propertyCode, setPropertyCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPropertyCode(new URLSearchParams(window.location.search).get("code") ?? ""); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/manager/password-recovery/request", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, propertyCode }), cache: "no-store" });
      const body: unknown = await response.json();
      setMessage(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message :
        body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Recovery is temporarily unavailable.");
    } catch { setMessage("Recovery is temporarily unavailable. Please try again later."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md p-6 space-y-4">
    <meta name="referrer" content="no-referrer" /><meta name="robots" content="noindex, nofollow" />
    <h1 className="text-2xl font-semibold">Forgot password?</h1>
    <form onSubmit={submit} className="space-y-4">
      <label className="block">Email<input className="block w-full rounded border p-3" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block">Property code<input className="block w-full rounded border p-3" inputMode="numeric" required pattern="[0-9]{4,5}" maxLength={5} value={propertyCode} onChange={e => setPropertyCode(e.target.value)} /></label>
      <button disabled={busy} className="w-full rounded bg-black p-3 text-white disabled:opacity-60">{busy ? "Submitting..." : "Send reset link"}</button>
    </form>
    <p role="status">{message}</p>
    {/* Full-document navigation prevents previously loaded analytics from observing reset tokens. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a href="/login/manager" className="underline">Back to login</a>
  </main>;
}
