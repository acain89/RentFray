"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { RepresentativeAdminDetail, RepresentativeAdminList } from "@/lib/representativeAdmin";
import styles from "./page.module.css";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "medium" }).format(new Date(value));
type Params = { cursor?: string; businessCursor?: string; payoutCursor?: string; monthBefore?: string; agreementCursor?: string };
export default function RepresentativeAdminClient({ representativeId }: { representativeId?: string }) {
  const [list, setList] = useState<RepresentativeAdminList | null>(null), [detail, setDetail] = useState<RepresentativeAdminDetail | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [params, setParams] = useState<Params>({}), [back, setBack] = useState<Record<string, string[]>>({});
  const [payoutKey, setPayoutKey] = useState("");
  const base = "/api/admin/representatives" + (representativeId ? `/${encodeURIComponent(representativeId)}` : "");
  async function read(next: Params) {
    const query = new URLSearchParams(); for (const [key, value] of Object.entries(next)) if (value) query.set(key, value);
    const response = await fetch(`${base}?${query}`, { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401 || response.status === 403) { window.location.assign("/login/admin"); throw new Error("Administrator access required."); }
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Please try again.");
    return data;
  }
  useEffect(() => {
    let cancelled = false;
    async function initial() {
      try { const data = await read({}); if (!cancelled) { if (representativeId) setDetail(data); else setList(data); } }
      catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : "Please try again."); }
      finally { if (!cancelled) setBusy(false); }
    }
    void initial(); return () => { cancelled = true; };
    // A route change remounts this page; subsequent navigation uses explicit cursors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, representativeId]);
  async function reload(next = params) {
    setBusy(true); setError("");
    try { const data = await read(next); if (representativeId) setDetail(data); else setList(data); setParams(next); return true; }
    catch (error) { setError(error instanceof Error ? error.message : "Please try again."); return false; }
    finally { setBusy(false); }
  }
  async function mutate(path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Please try again.");
      return result;
    } catch (error) { setError(error instanceof Error ? error.message : "Please try again."); return null; }
    finally { setBusy(false); }
  }
  async function paginate(key: keyof Params, next: string | null, forward: boolean) {
    const previous = back[key] ?? [];
    const value = forward ? next : previous[previous.length - 1] || undefined;
    if (forward && !next || !forward && !previous.length) return;
    if (await reload({ ...params, [key]: value })) setBack({ ...back, [key]: forward ? [...previous, params[key] ?? ""] : previous.slice(0, -1) });
  }
  const pager = (key: keyof Params, next: string | null) => <div className={styles.pager}>
    <button disabled={busy || !(back[key]?.length)} onClick={() => paginate(key, null, false)}>Previous</button>
    <button disabled={busy || !next} onClick={() => paginate(key, next, true)}>Next</button></div>;
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    const result = await mutate(base, "POST", { displayName: fields.get("displayName"), email: fields.get("email") });
    if (result) { form.reset(); setNotice(result.setupEmailSent ? "Representative created and setup email sent." : "Representative created. Setup email was not delivered; open the representative to resend it."); await reload({}); }
  }
  async function agreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    const result = await mutate(`${base}/agreements`, "POST", { effectiveAt: fields.get("effectiveAt"), agreementReference: fields.get("agreementReference"), agreementVersion: fields.get("agreementVersion") });
    if (result) { form.reset(); setNotice("Approved 36-month agreement recorded. Existing businesses were not changed."); await reload(); }
  }
  async function payout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    const operationKey = payoutKey || crypto.randomUUID(); setPayoutKey(operationKey);
    const result = await mutate(`${base}/payouts`, "POST", { amountUsd: fields.get("amountUsd"), paidAt: fields.get("paidAt"), reportingMonth: fields.get("reportingMonth"),
      externalPayoutReference: fields.get("externalPayoutReference"), note: fields.get("note"), operationKey });
    if (result) { form.reset(); setPayoutKey(""); setNotice("Completed manual payout recorded."); await reload(); }
  }
  const rep = detail?.representative;
  const active = detail?.activeAgreement ? [detail.activeAgreement] : [];
  return <main className={styles.shell} aria-busy={busy}>
    <nav><Link href="/admin">RentFray administration</Link>{representativeId && <Link href="/admin/representatives">All representatives</Link>}</nav>
    <header><div><p className={styles.eyebrow}>INDEPENDENT SALES REPRESENTATIVES</p><h1>{rep?.displayName ?? "Representatives"}</h1><p>{rep ? rep.email : "Accounts, approved agreements, acquired businesses, and completed manual payouts."}</p></div><button disabled={busy} onClick={() => reload()}>Refresh</button></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {busy && !list && !detail && <p role="status">Loading representative administration…</p>}
    {!representativeId && <>
      <section className={styles.card}><h2>Create a representative</h2><p>No temporary password is generated. The representative chooses a password through a secure email link.</p>
        <form onSubmit={create} className={styles.formGrid}><label>Name<input name="displayName" maxLength={120} required /></label><label>Email<input name="email" type="email" maxLength={254} required /></label><button disabled={busy}>Create and send setup email</button></form></section>
      <section className={styles.card}><h2>Representative accounts</h2><div className={styles.scroll}><table><thead><tr><th>Name / email</th><th>Login</th><th>Permanent referral URL</th><th /></tr></thead><tbody>{list?.items.map(row => <tr key={row.id}><td><strong>{row.displayName}</strong><small>{row.email}</small></td><td>{row.loginEnabled ? "Enabled" : "Disabled"}</td><td><a href={row.referralUrl}>{row.referralUrl}</a></td><td><Link href={`/admin/representatives/${row.id}`}>Manage</Link></td></tr>)}</tbody></table></div>{list?.items.length === 0 && <p>No representatives recorded yet.</p>}{pager("cursor", list?.nextCursor ?? null)}</section>
    </>}
    {detail && rep && <>
      <section className={styles.card}><div className={styles.actions}><span className={styles.badge}>Login {rep.loginEnabled ? "enabled" : "disabled"}</span>
        <button disabled={busy} onClick={async () => { if (await mutate(base, "PATCH", { loginEnabled: !rep.loginEnabled })) { setNotice("Login status updated. Prior sessions and reset links were revoked."); await reload(); } }}>{rep.loginEnabled ? "Disable login" : "Enable login"}</button>
        <button disabled={busy || !rep.loginEnabled} onClick={async () => { const result = await mutate(`${base}/password-reset`, "POST", {}); if (result) setNotice(result.setupEmailSent ? "Secure setup email sent." : "Email delivery was unavailable. Please retry."); }}>Send setup / reset email</button></div>
        <p>Referral URL: <a href={rep.referralUrl}>{rep.referralUrl}</a></p><p>Disabling login preserves this link, agreements, acquired businesses, and payout history.</p></section>
      <section className={styles.metrics} aria-label="Commission totals"><article><small>Earned this month</small><strong>{money(detail.report.summary.currentMonthCents)}</strong></article><article><small>Lifetime earned</small><strong>{money(detail.report.summary.lifetimeCents)}</strong></article><article><small>Recorded payouts</small><strong>{money(detail.report.summary.paidCents)}</strong></article><article><small>Outstanding</small><strong>{money(detail.report.summary.outstandingCents)}</strong></article></section>
      <section className={styles.card}><h2>Approved agreements</h2><p>No automatic renewals. Dates use America/Chicago; expiration is calculated as 36 calendar months after the effective date.</p>
        <form className={styles.formGrid} onSubmit={agreement}><label>Effective date (Chicago)<input name="effectiveAt" type="date" required /></label><label>Agreement reference<input name="agreementReference" maxLength={120} /></label><label>Version (optional)<input name="agreementVersion" maxLength={80} /></label><button disabled={busy}>Record approved agreement</button></form>
        <div className={styles.scroll}><table><thead><tr><th>Effective</th><th>Expires</th><th>Status</th><th>Reference / version</th></tr></thead><tbody>{detail.agreements.items.map(row => <tr key={row.id}><td>{date(row.effectiveAt)}</td><td>{date(row.expiresAt)}</td><td>{detail.report.asOf < row.effectiveAt ? "Upcoming" : detail.report.asOf < row.expiresAt ? "Active" : "Expired"}</td><td>{row.agreementReference ?? "—"}<small>{row.agreementVersion ?? ""} · {row.id}</small></td></tr>)}</tbody></table></div>{pager("agreementCursor", detail.agreements.nextCursor)}</section>
      <section className={styles.card}><h2>Acquired businesses</h2><p>Later authorization begins at the time it is recorded. Original attribution and the business’s 36-month expiration never change.</p>
        <div className={styles.scroll}><table><thead><tr><th>Business / created</th><th>Active units</th><th>Month / lifetime</th><th>Original window ends</th><th>Authorization</th></tr></thead><tbody>{detail.businesses.map(row => <tr key={row.id}>
          <td><strong>{row.name}</strong><small>{date(row.createdAt)}{row.archived ? " · Archived" : ""}</small></td><td>{row.activeUnits}</td><td>{money(row.currentMonthCents)}<small>Lifetime {money(row.lifetimeCents)}</small></td><td>{date(row.expiresAt)}<small>{row.daysRemaining} days remaining</small></td>
          <td><span className={styles.badge}>{row.status.replaceAll("_", " ")}</span>{row.authorizingAgreementId && <small>Agreement {row.authorizingAgreementId}<br />Eligible from {date(row.commissionEligibleFrom ?? row.createdAt)}</small>}
            {!row.authorizingAgreementId && row.productScope === "RENTFRAY" && row.daysRemaining > 0 && <form onSubmit={async event => { event.preventDefault(); const fields = new FormData(event.currentTarget); if (await mutate(`${base}/referrals/${row.id}`, "POST", { agreementId: fields.get("agreementId") })) { setNotice("Business authorized from the server-recorded time. No earlier payments became eligible."); await reload(); } }}>
              <select name="agreementId" aria-label={`Authorizing agreement for ${row.name}`} required><option value="">Choose active agreement</option>{active.map(a => <option key={a.id} value={a.id}>{date(a.effectiveAt)} – {date(a.expiresAt)}</option>)}</select><button disabled={busy || !active.length}>Authorize from now</button></form>}
            {row.productScope !== "RENTFRAY" && <small>Product unverified; tracking only.</small>}</td>
        </tr>)}</tbody></table></div>{pager("businessCursor", detail.report.businesses.nextCursor)}</section>
      <section className={styles.card}><h2>Record a completed manual payout</h2><p>Pay outside RentFray first. Recording a payout does not send money. Dates use America/Chicago.</p>
        <form className={styles.formGrid} onSubmit={payout}><label>Amount (USD)<input name="amountUsd" inputMode="decimal" placeholder="125.00" pattern="[0-9]+([.][0-9]{1,2})?" required /></label><label>Date paid<input name="paidAt" type="date" required /></label><label>Reporting month<input name="reportingMonth" type="month" required /></label><label>External payment reference<input name="externalPayoutReference" maxLength={200} required /></label><label className={styles.wide}>Optional note<textarea name="note" maxLength={1000} rows={2} /></label><button disabled={busy}>Record completed payout</button></form>
      </section>
      <section className={styles.card}><h2>Permanent payout history</h2><div className={styles.scroll}><table><thead><tr><th>Date paid</th><th>Month</th><th>Amount</th><th>External reference</th><th>Note</th></tr></thead><tbody>{detail.payouts.map(row => <tr key={row.id}><td>{date(row.paidAt)}</td><td>{row.reportingMonth}</td><td>{money(row.amountCents)}</td><td>{row.externalPayoutReference}</td><td>{row.note ?? "—"}</td></tr>)}</tbody></table></div>{detail.payouts.length === 0 && <p>No completed payouts recorded.</p>}{pager("payoutCursor", detail.report.payouts.nextCursor)}</section>
      <section className={styles.card}><h2>Monthly commission history</h2><div className={styles.scroll}><table><thead><tr><th>Month</th><th>Qualifying transactions</th><th>Commission</th></tr></thead><tbody>{detail.report.history.items.map(row => <tr key={row.month}><td>{row.month}</td><td>{row.payments}</td><td>{money(row.commissionCents)}</td></tr>)}</tbody></table></div>{pager("monthBefore", detail.report.history.nextMonthBefore)}</section>
    </>}
    <footer>Commissions reflect current qualifying payment records. This interface never initiates payments or changes tenant accounting.</footer>
  </main>;
}
