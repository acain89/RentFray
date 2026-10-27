"use client";

import { useState } from "react";
import Link from "next/link";
import type { RepresentativeDashboard as Report, RepresentativeReportOptions } from "@/lib/representativeReports";
import styles from "./page.module.css";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const monthName = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00Z`));

export default function RepresentativeDashboard({ initial }: { initial: Report }) {
  const [report, setReport] = useState(initial), [params, setParams] = useState<RepresentativeReportOptions>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [copyMessage, setCopyMessage] = useState("");
  const [businessBack, setBusinessBack] = useState<string[]>([]), [payoutBack, setPayoutBack] = useState<string[]>([]), [monthBack, setMonthBack] = useState<string[]>([]);
  async function load(next: RepresentativeReportOptions): Promise<boolean> {
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) if (value) query.set(key, value);
      const response = await fetch(`/api/representative/dashboard?${query}`, { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) { window.location.assign("/login/representative"); return false; }
      if (!response.ok) throw new Error();
      setReport(await response.json()); setParams(next); return true;
    } catch { setError("Your report couldn’t be loaded. Please try again."); return false; } finally { setBusy(false); }
  }
  async function page(kind: "business" | "payout" | "month", forward: boolean) {
    const key = kind === "business" ? "businessCursor" : kind === "payout" ? "payoutCursor" : "monthBefore";
    const back = kind === "business" ? businessBack : kind === "payout" ? payoutBack : monthBack;
    const setBack = kind === "business" ? setBusinessBack : kind === "payout" ? setPayoutBack : setMonthBack;
    const next = kind === "business" ? report.businesses.nextCursor : kind === "payout" ? report.payouts.nextCursor : report.history.nextMonthBefore;
    if (forward && next && await load({ ...params, [key]: next })) setBack([...back, params[key] ?? ""]);
    if (!forward && back.length && await load({ ...params, [key]: back[back.length - 1] || undefined })) setBack(back.slice(0, -1));
  }
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/representative/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error();
      window.location.assign("/login/representative");
    } catch { setError("We couldn’t sign you out. Please try again."); setBusy(false); }
  }
  const pager = (kind: "business" | "payout" | "month", hasBack: boolean, hasNext: boolean) => <div className={styles.pager}>
    <button disabled={busy || !hasBack} onClick={() => page(kind, false)}>← {kind === "month" ? "Newer" : "Previous"}</button>
    <button disabled={busy || !hasNext} onClick={() => page(kind, true)}>{kind === "month" ? "Older months" : "Next"} →</button>
  </div>;
  const agreement = report.agreement;
  return <div className={styles.shell}>
    <header className={styles.nav}><div className={styles.navInner}><Link href="/r/portal" className={styles.brand}>RentFray<span>REPRESENTATIVES</span></Link>
      <button disabled={busy} onClick={logout}>Sign out ↗</button></div></header>
    <main className={styles.main} aria-busy={busy}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>YOUR BUSINESS AT A GLANCE</p><h1>Hello, {report.displayName}.</h1>
        <p>Your relationships. Your progress. Your earnings.</p></div><span className={styles.date}>As of {date(report.asOf)} · Chicago time</span></div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <section className={styles.topGrid} aria-label="Agreement and referral link">
        <article className={styles.agreement}><div className={styles.cardHeading}><h2>Your agreement</h2><span className={styles.badge}>{agreement?.status === "ACTIVE" ? "Active" : agreement?.status === "EXPIRED" ? "Expired" : agreement ? "Upcoming" : "Not recorded"}</span></div>
          {agreement ? <><div className={styles.agreementDates}><div><small>Effective date</small><strong>{date(agreement.effectiveAt)}</strong></div><span aria-hidden="true">→</span><div><small>Expiration date</small><strong>{date(agreement.expiresAt)}</strong></div></div>
            <p>{agreement.status === "EXPIRED" ? "Your dashboard and existing business commission windows remain available." : `${agreement.daysRemaining.toLocaleString()} days until expiration`}</p></> : <p>Your agreement details will appear here once recorded.</p>}</article>
        <article className={styles.card}><p className={styles.eyebrow}>GROW YOUR PORTFOLIO</p><h2>Your permanent referral link</h2><p className={styles.muted}>Share this link with new businesses.</p>
          <div className={styles.copyRow}><input aria-label="Your referral URL" readOnly value={report.referralUrl} onFocus={event => event.currentTarget.select()} /><button onClick={async () => {
            try { await navigator.clipboard.writeText(report.referralUrl); setCopyMessage("Link copied."); } catch { setCopyMessage("Select the link and copy it manually."); }
          }}>Copy link</button></div><span role="status" className={styles.copyStatus}>{copyMessage}</span></article>
      </section>
      <section aria-labelledby="earnings-title"><div className={styles.sectionHeading}><h2 id="earnings-title">Commission overview</h2><span>{monthName(report.reportingMonth)}</span></div>
        <div className={styles.metrics}>
          <article><small>Qualifying payments this month</small><strong>{report.summary.currentMonthPayments.toLocaleString()}</strong><span>$2.50 per qualifying transaction</span></article>
          <article className={styles.accentMetric}><small>Earned this month</small><strong>{money(report.summary.currentMonthCents)}</strong><span>Current recorded payments</span></article>
          <article><small>Lifetime earned</small><strong>{money(report.summary.lifetimeCents)}</strong><span>Across your acquired businesses</span></article>
          <article><small>Manually paid</small><strong>{money(report.summary.paidCents)}</strong><span>Recorded by RentFray</span></article>
          <article><small>Outstanding</small><strong>{money(Math.max(0, report.summary.outstandingCents))}</strong><span>Current earned amount less payouts</span></article>
        </div>{report.summary.outstandingCents < 0 && <p className={styles.note}>Recorded payouts exceed current calculated earnings by {money(-report.summary.outstandingCents)}. Past payments remain in your history.</p>}
      </section>
      <section className={styles.tableCard} aria-labelledby="businesses-title"><div className={styles.tableHeading}><div><h2 id="businesses-title">Your businesses <span>{report.summary.acquiredBusinesses.toLocaleString()}</span></h2><p>Each qualifying business has its own 36-month commission window.</p></div><span className={styles.eyebrow}>THIS MONTH</span></div>
        {report.businesses.items.length ? <table className={styles.businesses}><thead><tr><th>Business</th><th>Active units</th><th>Payments</th><th>Commission</th><th>Commission window</th></tr></thead><tbody>{report.businesses.items.map(business => <tr key={business.id}>
          <td data-label="Business"><strong>{business.name}</strong><small>Created {date(business.createdAt)}{business.archived ? " · Archived" : ""}</small></td>
          <td data-label="Active units">{business.activeUnits.toLocaleString()}</td><td data-label="Payments">{business.currentMonthPayments.toLocaleString()}</td><td data-label="Commission">{money(business.currentMonthCents)}</td>
          <td data-label="Commission window"><span className={business.status === "ELIGIBLE" ? styles.eligible : styles.tracking}>{business.status === "ELIGIBLE" ? "Commission eligible" : business.status === "WINDOW_ENDED" ? "Window ended" : "Tracking only"}</span><small>{date(business.expiresAt)} · {business.daysRemaining.toLocaleString()} days left</small></td>
        </tr>)}</tbody></table> : <p className={styles.empty}>Your acquired businesses will appear here. Share your referral link to get started.</p>}
        {pager("business", businessBack.length > 0, Boolean(report.businesses.nextCursor))}
      </section>
      <div className={styles.historyGrid}>
        <section className={styles.tableCard} aria-labelledby="history-title"><div className={styles.tableHeading}><div><h2 id="history-title">Monthly commissions</h2><p>Reporting months use America/Chicago.</p></div></div>
          <table><thead><tr><th>Month</th><th>Payments</th><th>Earned</th></tr></thead><tbody>{report.history.items.map(row => <tr key={row.month}><td>{monthName(row.month)}</td><td>{row.payments.toLocaleString()}</td><td>{money(row.commissionCents)}</td></tr>)}</tbody></table>
          {pager("month", monthBack.length > 0, Boolean(report.history.nextMonthBefore))}</section>
        <section className={styles.tableCard} aria-labelledby="payouts-title"><div className={styles.tableHeading}><div><h2 id="payouts-title">Payout history</h2><p>Manual payments recorded by RentFray.</p></div></div>
          {report.payouts.items.length ? <table><thead><tr><th>Paid on</th><th>Reporting month</th><th>Amount</th></tr></thead><tbody>{report.payouts.items.map(row => <tr key={row.id}><td>{date(row.paidAt)}</td><td>{monthName(row.reportingMonth)}</td><td>{money(row.amountCents)}</td></tr>)}</tbody></table>
            : <div className={styles.payoutEmpty}><span aria-hidden="true">↗</span><h3>No payouts recorded yet</h3><p>Your manual payout history will appear here once payments are recorded.</p></div>}
          {pager("payout", payoutBack.length > 0, Boolean(report.payouts.nextCursor))}</section>
      </div>
      <footer className={styles.footer}>Commissions reflect currently qualifying payments and may change if payment statuses change. Your referral link and historical dashboard remain available after agreement expiration.</footer>
    </main>
  </div>;
}
