import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export function checkoutFixture() {
  const identity = { propertyId: "p", unitId: "u", tenantAssignmentId: "a" };
  const rows: any[] = []; const sessions = new Map<string, any>(); const intents = new Map<string, any>();
  const calls: string[] = []; const control: any = { unavailable: false, missing: false, onRetrieve: null };
  const stripe = {
    checkout: { sessions: { retrieve: async (id: string) => { calls.push("checkout:" + id); control.onRetrieve?.();
      if (control.unavailable) throw Error("dependency offline"); if (control.missing || !sessions.has(id)) throw { code: "resource_missing" };
      return structuredClone(sessions.get(id)); } } },
    paymentIntents: { retrieve: async (id: string) => { calls.push("intent:" + id); control.onRetrieve?.();
      if (control.unavailable) throw Error("dependency offline"); if (!intents.has(id)) throw { code: "resource_missing" };
      return structuredClone(intents.get(id)); } },
  };
  class FakeStripe { constructor() { return stripe; } }
  const module = { exports: {} as any };
  const source = ts.transpileModule(readFileSync(resolve(__dirname, "../lib/checkoutCollectibility.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, Date, Object, process: { env: { STRIPE_SECRET_KEY: "isolated" } },
    require(name: string) { assert.equal(name, "stripe"); return FakeStripe; } });
  const helper = module.exports;
  const db: any = { payment: { findMany: async ({ where }: any) => structuredClone(rows.filter(p => p.propertyId === where.propertyId &&
    p.unitId === where.unitId && p.tenantAssignmentId === where.tenantAssignmentId && p.paymentMethod === where.paymentMethod && where.status.in.includes(p.status))) },
    $executeRaw: async (_: any, key: string) => { calls.push("lock:" + key); },
  };
  function add(status = "open", id = "one") {
    const p: any = { id, ...identity, billingCycle: "2026-09", amountCents: 100000, processingFeeCents: 100,
      stripeSessionId: "cs-" + id, stripePaymentIntentId: null, paymentMethod: "ACH", status: "UNPAID", createdAt: new Date("2026-10-01") };
    const metadata = { paymentId: id, ...identity, stripeAccountId: "acct", billingCycle: p.billingCycle,
      ledgerBalanceCents: "100000", processingFeeCents: "100", totalAmountCents: "100100" };
    const s: any = { id: p.stripeSessionId, metadata, amount_total: 100100, status, payment_status: "unpaid", url: "https://isolated.invalid/pay", payment_intent: null };
    const intent: any = { id: "pi-" + id, status: "processing", metadata, currency: "usd", amount: 100100,
      payment_method_types: ["us_bank_account"], transfer_data: { destination: "acct" }, on_behalf_of: "acct" };
    rows.push(p); sessions.set(s.id, s); intents.set(intent.id, intent); return { p, s, intent };
  }
  return { helper, db, rows, identity, sessions, intents, calls, control, stripe, add,
    inspect: () => helper.inspectTenantCheckoutAttempts(db, identity),
    guard: (snapshot: any) => helper.assertCheckoutReductionAllowed(db, snapshot) };
}
for (const local of ["UNPAID", "PENDING", "FAILED"]) test(local + " open Checkout remains collectible", async () => {
  const f = checkoutFixture(); f.add().p.status = local; const proof = await f.inspect(); assert.equal(proof.state, "COLLECTIBLE");
  await assert.rejects(f.guard(proof), (e: any) => e.status === 409); assert.equal(f.rows[0].status, local);
});
for (const [status, expected] of [["processing", "COLLECTIBLE"], ["succeeded", "UNRESOLVED"], ["canceled", "PROVEN_NONCOLLECTIBLE"], ["requires_payment_method", "UNRESOLVED"]]) test("complete Intent " + status, async () => {
  const f = checkoutFixture(), a = f.add("complete"); a.s.payment_intent = a.intent.id; a.intent.status = status;
  const proof = await f.inspect(); assert.equal(proof.state, expected);
});
test("expired unpaid without Intent proves noncollectibility", async () => { const f = checkoutFixture(); f.add("expired"); const p = await f.inspect(); assert.equal(p.state, "PROVEN_NONCOLLECTIBLE"); await f.guard(p); });
test("expired but processing/succeeded associated Intent fails closed", async () => { for (const status of ["processing", "succeeded"]) { const f = checkoutFixture(), a = f.add("expired"); a.s.payment_intent = a.intent.id; a.intent.status = status; await assert.rejects(f.guard(await f.inspect())); } });
test("canceled associated Intent without Checkout is terminal", async () => { const f = checkoutFixture(), a = f.add(); a.p.stripeSessionId = null; a.p.stripePaymentIntentId = a.intent.id; a.intent.status = "canceled"; assert.equal((await f.inspect()).state, "PROVEN_NONCOLLECTIBLE"); });
test("identifier-less reservation remains unresolved and recoverable without age assumptions", async () => { const f = checkoutFixture(); const a = f.add(); a.p.stripeSessionId = null; a.p.createdAt = new Date(0); const p = await f.inspect(); assert.equal(p.state, "UNRESOLVED"); assert.equal(p.evidence[0].recoverable, true); await assert.rejects(f.guard(p), (e: any) => e.status === 409); });
for (const kind of ["missing", "identity", "amount", "intentIdentity", "dependency"]) test("fail closed " + kind, async () => {
  const f = checkoutFixture(), a = f.add(); if (kind === "missing") f.control.missing = true;
  if (kind === "identity") a.s.metadata.tenantAssignmentId = "foreign";
  if (kind === "amount") a.s.amount_total++;
  if (kind === "intentIdentity") a.p.stripePaymentIntentId = "wrong";
  if (kind === "dependency") f.control.unavailable = true;
  const proof = await f.inspect(); assert.equal(proof.state, "UNRESOLVED"); await assert.rejects(f.guard(proof), (e: any) => e.status === (kind === "dependency" ? 503 : 409));
});
for (const status of ["PAID", "REVERSED"]) test(status + " committed state is not outstanding", async () => { const f = checkoutFixture(); f.add().p.status = status; const proof = await f.inspect(); assert.equal(proof.state, "NO_ATTEMPT"); await f.guard(proof); assert.equal(f.calls.length, 0); });
test("all relevant attempts across cycles inspected; any collectible blocks", async () => { const f = checkoutFixture(); f.add("expired"); const b = f.add("open", "two"); b.p.billingCycle = b.s.metadata.billingCycle = "2026-10"; const proof = await f.inspect(); assert.equal(proof.evidence.length, 2); await assert.rejects(f.guard(proof)); assert.equal(f.calls.length, 2); });
test("helper snapshots are immutable and helper writes/calculates nothing", async () => { const f = checkoutFixture(); f.add("expired"); const proof = await f.inspect(); assert.ok(Object.isFrozen(proof) && Object.isFrozen(proof.identity) && Object.isFrozen(proof.evidence)); await f.guard(proof); assert.equal(f.rows.length, 1); assert.equal(f.rows[0].status, "UNPAID"); const source = readFileSync(resolve(__dirname, "../lib/checkoutCollectibility.ts"), "utf8"); assert.ok(!/payment\.(update|create)|ledgerEntry|sessions\.(create|expire)|paymentIntents\.cancel|getUnitFinancialState/.test(source)); });
