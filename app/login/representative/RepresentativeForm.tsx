"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import styles from "./representativeAuth.module.css";

export default function RepresentativeForm({ mode }: { mode: "login" | "request" | "reset" }) {
  const token = useRef("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(""), [done, setDone] = useState(false);
  // Capture and remove the fragment before passive effects/afterInteractive
  // analytics run. Tokens never appear in a query string, referrer, or API URL.
  useLayoutEffect(() => {
    if (mode !== "reset") return;
    const captured = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (captured) token.current = captured;
    window.history.replaceState(null, "", window.location.pathname);
  }, [mode]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const fields = new FormData(event.currentTarget);
    if (mode === "reset" && !/^[a-f0-9]{64}$/.test(token.current)) { setError("Open the latest reset link from your email, or request a new link."); return; }
    setBusy(true);
    try {
      const endpoint = mode === "login" ? "/api/representative/session" : `/api/representative/password-recovery/${mode}`;
      const body = mode === "reset" ? { token: token.current, password: fields.get("password"), confirmation: fields.get("confirmation") }
        : { email: fields.get("email"), ...(mode === "login" ? { password: fields.get("password") } : {}) };
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setError(typeof result.error === "string" ? result.error : "Please try again."); return; }
      if (mode === "login") { window.location.assign("/r/portal"); return; }
      setDone(true);
      setMessage(mode === "request" ? result.message : "Your password has been updated. Sign in with your new password.");
      if (mode === "reset") token.current = "";
    } catch { setError("We couldn’t complete your request. Please try again."); } finally { setBusy(false); }
  }
  const title = mode === "login" ? "Welcome back." : mode === "request" ? "Forgot your password?" : "Choose a new password.";
  return <main className={styles.shell}>
    <Link className={styles.brand} href="/">RentFray<span>Representatives</span></Link>
    <section className={styles.card} aria-labelledby="representative-auth-title">
      <p className={styles.eyebrow}>YOUR REPRESENTATIVE PORTAL</p>
      <h1 id="representative-auth-title">{title}</h1>
      <p className={styles.intro}>{mode === "login" ? "Sign in to see your businesses, commission windows, and earnings." :
        mode === "request" ? "Enter your representative email. We’ll send a secure link if your account is eligible." : "Use at least 8 characters. Only your latest reset link can be used."}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}
      {!done && <form onSubmit={submit} aria-busy={busy}>
        {mode !== "reset" && <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
        {mode !== "request" && <label>{mode === "reset" ? "New password" : "Password"}<input name="password" type="password" autoComplete={mode === "reset" ? "new-password" : "current-password"} minLength={8} maxLength={72} required /></label>}
        {mode === "reset" && <label>Confirm new password<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>}
        <button disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "request" ? "Send reset link" : "Update password"}<span aria-hidden="true">→</span></button>
      </form>}
      <div className={styles.links}>{mode === "login" ? <Link href="/login/representative/forgot-password">Forgot password?</Link> :
        <Link href="/login/representative">Back to sign in</Link>}
        {mode === "reset" && <Link href="/login/representative/forgot-password">Request a new link</Link>}</div>
    </section>
    <p className={styles.footer}>Your RentFray representative account is separate from property management.</p>
  </main>;
}
