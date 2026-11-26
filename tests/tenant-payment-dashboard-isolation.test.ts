import { recordRows, requiredRecord, requiredDate } from "./fixture-assertions";
import type { ReadQuery } from "./tenant-payment-history-isolation.fixture";
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { load, json, session, entry, hostileRows, matches } from "./tenant-payment-history-isolation.fixture";

export function dashboardFixture() {
  const rows = hostileRows(); rows.push(entry("legacy-credit", { entryType: "CHARGE", chargeType: "PROCESSING_FEE", tenantAssignmentId: null }));
  rows.push(entry("rent", { entryType: "CHARGE", chargeType: "RENT", amountCents: 10000, paymentId: null, payment: null }));
  const payments = ["b", "a", null].map(tenantAssignmentId => ({ id: String(tenantAssignmentId), propertyId: "p", unitId: "u", tenantAssignmentId,
    status: "PAID", amountCents: 1234, createdAt: new Date("2026-01-01"), paidAt: null, failedAt: null, reversedAt: null }));
  const queries: ReadQuery[] = []; const financialCalls: Record<string, unknown>[] = [];
  const summary = { totalPaidCents: 9876, balanceCents: 8765, totalChargesCents: 11000, hasPendingPayment: true,
    pendingPaymentAmountCents: 5432, lastPaymentDate: new Date("2026-10-01"), lastPaymentAmountCents: 9999 };
  const financial = { ledgerSummary: summary, ledgerBalanceCents: 8765, processingFeeCents: 100, tenantTotalDueCents: 8865,
    rentDates: {}, billingCycle: "2026-10", isDelinquent: false, hasPendingPayment: true,
    status: { paymentStatus: "PENDING", status: "PENDING", canAttemptPayment: false } };
  const db = { unit: { findFirst: async () => ({ id: "u", unitNumber: "101", tier: {}, property: { id: "p", name: "Property", status: "LIVE", settings: {}, units: [] } }) },
    tenantAssignment: { findFirst: async () => ({ id: "b" }) },
    payment: { findMany: async (args: ReadQuery) => { queries.push(args); return payments.filter(row => matches(row, args.where)); } },
    ledgerEntry: { findMany: async (args: ReadQuery) => { queries.push(args); return rows.filter(row => matches(row, args.where)); },
      findFirst: async (args: ReadQuery) => { queries.push(args); return rows.filter(row => matches(row, args.where))[0] ?? null; } } };
  const imports = { "next/server": json, "@/lib/prisma": { prisma: db },
    "@/lib/session": { getSession: async () => session, requireRole: async () => session, refreshSessionCookie: async () => {} },
    "@/lib/billingConfig": { getProcessingFeeCents: () => 100, formatCentsToDollars: (n: number) => n / 100 },
    "@/lib/liveGating": { canMakePayments: () => true },
    "@/lib/unitFinancialState": { getUnitFinancialState: async (input: Record<string, unknown>) => { financialCalls.push(input); return financial; } },
    "@/lib/propertyStatus": { shouldAutoSetPropertyReady: () => false }, "@/lib/rentDates": {},
    "@/lib/ledger": { getUnitLedgerSummary: async (input: Record<string, unknown>) => { financialCalls.push(input); return summary; } } };
  return { rows, payments, queries, financialCalls, summary, imports };
}
test("dashboard private history excludes prior, null and mismatched ownership; accounting unchanged", async () => {
  const f = dashboardFixture(); const before = JSON.stringify([f.rows, f.payments]);
  const result = await load("app/api/tenant/dashboard/route.ts", f.imports).POST(); assert.equal(result.status, 200);
  assert.deepEqual(Array.from(recordRows(result.body.paymentHistory), (r) => r.id), ["b"]);
  assert.deepEqual(Array.from(recordRows(result.body.ledger), (r) => r.id), ["b", "rent"]);
  assert.deepEqual(Array.from(recordRows(requiredRecord(result.body.statement).items), (r) => r.label), ["b", "rent"]);
  assert.equal(result.body.balanceCents, 8765); assert.equal(result.body.totalDueCents, 8865);
  assert.equal(result.body.totalPaidCents, 9876); assert.equal(result.body.hasPendingPayment, true);
  assert.equal(requiredRecord(result.body.statement).totalDue, 88.65);
  const accounting = f.rows.filter(row => matches(row, f.queries[1].where));
  assert.equal(requiredRecord(result.body.statement).credits, accounting.filter(row => row.entryType === "PAYMENT").length * 1234 / 100);
  assert.equal(requiredRecord(result.body.statement).processingFee, 0); // legacy fee still has accounting effect
  assert.equal(f.financialCalls[0].tenantAssignmentId, "b"); assert.equal(JSON.stringify([f.rows, f.payments]), before);
});
test("balance last payment comes from exact ledger/Payment ownership while summary totals stay unchanged", async () => {
  const f = dashboardFixture(); const result = await load("app/api/tenant/balance/route.ts", f.imports).GET();
  assert.equal(result.status, 200); assert.equal(result.body.lastPaymentAmountCents, 1234);
  assert.equal(requiredDate(result.body.lastPaymentDate).toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(result.body.balanceCents, f.summary.balanceCents); assert.equal(result.body.paymentsCents, f.summary.totalPaidCents);
  assert.equal(result.body.pendingPaymentAmountCents, 5432); assert.equal(result.body.hasPendingPayment, true);
  const q = f.queries[0]; assert.equal(q.where.tenantAssignmentId, "b"); assert.equal(requiredRecord(requiredRecord(q.where.payment).is).tenantAssignmentId, "b");
  assert.deepEqual(JSON.parse(JSON.stringify(q.orderBy)), [{ effectiveDate: "desc" }, { createdAt: "desc" }, { id: "desc" }]);
});
test("balance without owned paid history returns null metadata and retains accounting", async () => {
  const f = dashboardFixture(); f.rows.splice(0, 1);
  const result = await load("app/api/tenant/balance/route.ts", f.imports).GET();
  assert.equal(result.body.lastPaymentDate, null); assert.equal(result.body.lastPaymentAmountCents, null);
  assert.equal(result.body.balanceCents, 8765); assert.equal(result.body.pendingPaymentAmountCents, 5432);
});
test("dashboard authoritative aggregates exactly match HEAD with legacy and linked records", async () => {
  const before = execFileSync("git", ["--no-optional-locks", "show", "HEAD:app/api/tenant/dashboard/route.ts"], { cwd: resolve(__dirname, ".."), encoding: "utf8", windowsHide: true });
  const old = await load("app/api/tenant/dashboard/route.ts", dashboardFixture().imports, before).POST();
  const current = await load("app/api/tenant/dashboard/route.ts", dashboardFixture().imports).POST();
  for (const key of ["balanceCents", "processingFeeCents", "totalDueCents", "hasPendingPayment", "pendingPaymentAmountCents", "pendingPaymentAmount", "balance", "processingFee", "totalDue", "totalPaidCents", "totalPaid", "paymentStatus", "displayStatus"]) assert.equal(current.body[key], old.body[key], key);
  for (const key of ["rent", "recurringCharges", "lateFees", "processingFee", "credits", "subtotal", "totalDue"]) assert.equal(requiredRecord(current.body.statement)[key], requiredRecord(old.body.statement)[key], key);
});
