import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { stage2Load } from "./representative-stage2-fixture";
import type { RepresentativeDashboard } from "../lib/representativeReports";

export const representativePreview: RepresentativeDashboard = {
  asOf: "2026-10-15T12:00:00Z", displayName: "Jordan", referralUrl: "https://www.rentfray.com/r/jordan", reportingMonth: "2026-10",
  agreement: { effectiveAt: "2024-01-01T06:00:00Z", expiresAt: "2027-01-01T06:00:00Z", status: "ACTIVE", daysRemaining: 78 },
  summary: { acquiredBusinesses: 28, currentMonthPayments: 143, currentMonthCents: 35750, lifetimeCents: 124500, paidCents: 80000, outstandingCents: 44500 },
  businesses: { items: [
    { id: "one", name: "Oak & Pine Management", createdAt: "2024-06-01T05:00:00Z", activeUnits: 82, currentMonthPayments: 69, currentMonthCents: 17250, expiresAt: "2027-06-01T05:00:00Z", daysRemaining: 229, status: "ELIGIBLE", archived: false },
    { id: "two", name: "Riverbend Rentals", createdAt: "2025-04-20T05:00:00Z", activeUnits: 56, currentMonthPayments: 48, currentMonthCents: 12000, expiresAt: "2028-04-20T05:00:00Z", daysRemaining: 553, status: "ELIGIBLE", archived: false },
    { id: "three", name: "Westside Apartments", createdAt: "2025-09-12T05:00:00Z", activeUnits: 34, currentMonthPayments: 26, currentMonthCents: 6500, expiresAt: "2028-09-12T05:00:00Z", daysRemaining: 698, status: "ELIGIBLE", archived: false },
    { id: "four", name: "Historical business", createdAt: "2020-01-01T06:00:00Z", activeUnits: 0, currentMonthPayments: 0, currentMonthCents: 0, expiresAt: "2023-01-01T06:00:00Z", daysRemaining: 0, status: "TRACKING_ONLY", archived: true },
  ], nextCursor: "next-businesses" },
  history: { items: [{ month: "2026-10", payments: 143, commissionCents: 35750 }, { month: "2026-09", payments: 128, commissionCents: 32000 }, { month: "2026-08", payments: 119, commissionCents: 29750 }], nextMonthBefore: "2026-08" },
  payouts: { items: [], nextCursor: null },
};
const link = ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", { href, ...props }, children);
function component(file: string, css: string) {
  return stage2Load<{ default: React.ComponentType<Record<string, unknown>> }>(file, { react: React, "react/jsx-runtime": jsx, "next/link": link,
    [css]: new Proxy({}, { get: (_target, key) => String(key) }) }).default;
}
test("dashboard renders responsive sections, accessible link copy, archive and payout empty states", () => {
  const Dashboard = component("app/r/portal/RepresentativeDashboard.tsx", "./page.module.css");
  const html = renderToStaticMarkup(<Dashboard initial={representativePreview} />);
  for (const label of ["Hello, Jordan.", "Your agreement", "Copy link", "Commission overview", "Your businesses", "Monthly commissions", "Payout history", "No payouts recorded yet", "$357.50", "$445.00", "Tracking only", "Archived"]) assert.ok(html.includes(label), label);
  assert.match(html, /aria-label="Your referral URL"/);
  assert.doesNotMatch(html, /tenantAssignmentId|passwordHash|externalPayoutReference|operationKey/);
});
test("dashboard escapes business names and preserves negative-outstanding history", () => {
  const Dashboard = component("app/r/portal/RepresentativeDashboard.tsx", "./page.module.css");
  const report = { ...representativePreview, displayName: "<script>bad</script>", summary: { ...representativePreview.summary, outstandingCents: -100 },
    payouts: { items: [{ id: "paid", paidAt: "2026-09-01", amountCents: 80000, reportingMonth: "2026-08" }], nextCursor: null } };
  const html = renderToStaticMarkup(<Dashboard initial={report} />);
  assert.ok(html.includes("&lt;script&gt;")); assert.ok(!html.includes("<script>bad"));
  assert.ok(html.includes("$0.00")); assert.ok(html.includes("exceed current calculated earnings by $1.00")); assert.ok(html.includes("$800.00"));
});
test("login and recovery forms use correct password autocomplete and field labels", () => {
  const Form = component("app/login/representative/RepresentativeForm.tsx", "./representativeAuth.module.css");
  const login = renderToStaticMarkup(<Form mode="login" />), reset = renderToStaticMarkup(<Form mode="reset" />);
  assert.match(login, /autoComplete="current-password"/); assert.match(login, /Email address/);
  assert.match(reset, /autoComplete="new-password"/); assert.match(reset, /Confirm new password/);
  assert.doesNotMatch(reset, /name="token"/);
});
