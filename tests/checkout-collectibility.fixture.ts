import { requiredText, requiredValue } from "./fixture-assertions";
import type { CheckoutIdentity, CheckoutPayment, CheckoutInspection } from "../lib/checkoutCollectibility";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";


export function checkoutFixture() {
  const identity = { propertyId: "p", unitId: "u", tenantAssignmentId: "a" };
  type Payment = CheckoutPayment & { paymentMethod: string };
  type Metadata = Record<string, string>;
  type Session = { id: string; metadata: Metadata; amount_total: number; status: string; payment_status: string; url: string; payment_intent: string | null };
  type Intent = { id: string; status: string; metadata: Metadata; currency: string; amount: number; payment_method_types: string[]; transfer_data: { destination: string }; on_behalf_of: string };
  const rows: Payment[] = []; const sessions = new Map<string, Session>(); const intents = new Map<string, Intent>();
  const calls: string[] = []; const control: { unavailable: boolean; missing: boolean; onRetrieve: (() => void) | null } = { unavailable: false, missing: false, onRetrieve: null };
  const stripe = {
    checkout: { sessions: { retrieve: async (id: string) => { calls.push("checkout:" + id); control.onRetrieve?.();
      if (control.unavailable) throw Error("dependency offline"); if (control.missing || !sessions.has(id)) throw { code: "resource_missing" };
      return structuredClone(sessions.get(id)); } } },
    paymentIntents: { retrieve: async (id: string) => { calls.push("intent:" + id); control.onRetrieve?.();
      if (control.unavailable) throw Error("dependency offline"); if (!intents.has(id)) throw { code: "resource_missing" };
      return structuredClone(intents.get(id)); } },
  };
  class FakeStripe { constructor() { return stripe; } }
  type Reader = { payment: { findMany(args: { where: CheckoutIdentity & { paymentMethod: string; status: { in: string[] } } }): Promise<Payment[]> } };
  type Lock = { $executeRaw(sql: TemplateStringsArray, key: string): Promise<unknown> };
  type Helper = {
    inspectTenantCheckoutAttempts(db: Reader, identity: CheckoutIdentity): Promise<CheckoutInspection>;
    assertCheckoutReductionAllowed(db: Reader & Lock, snapshot: CheckoutInspection): Promise<void>;
    lockCheckout(db: Lock, identity: CheckoutIdentity & { billingCycle?: string | null }): Promise<void>;
  };
  const fixtureModule: { exports: Partial<Helper> } = { exports: {} };
  const source = ts.transpileModule(readFileSync(resolve(__dirname, "../lib/checkoutCollectibility.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, { module: fixtureModule, exports: fixtureModule.exports, Date, Object, process: { env: { STRIPE_SECRET_KEY: "isolated" } },
    require(name: string) { assert.equal(name, "stripe"); return FakeStripe; } });
  const helper = { ...fixtureModule.exports, inspectTenantCheckoutAttempts: requiredValue(fixtureModule.exports.inspectTenantCheckoutAttempts), assertCheckoutReductionAllowed: requiredValue(fixtureModule.exports.assertCheckoutReductionAllowed), lockCheckout: requiredValue(fixtureModule.exports.lockCheckout) };
  const db: Reader & Lock = { payment: { findMany: async ({ where }) => structuredClone(rows.filter(p => p.propertyId === where.propertyId &&
    p.unitId === where.unitId && p.tenantAssignmentId === where.tenantAssignmentId && p.paymentMethod === where.paymentMethod && where.status.in.includes(p.status))) },
    $executeRaw: async (_: TemplateStringsArray, key: string) => { calls.push("lock:" + key); },
  };
  function add(status = "open", id = "one") {
    const p: Payment = { id, ...identity, billingCycle: "2026-09", amountCents: 100000, processingFeeCents: 100,
      stripeSessionId: "cs-" + id, stripePaymentIntentId: null, paymentMethod: "ACH", status: "UNPAID", createdAt: new Date("2026-10-01") };
    const metadata = { paymentId: id, ...identity, stripeAccountId: "acct", billingCycle: requiredText(p.billingCycle),
      ledgerBalanceCents: "100000", processingFeeCents: "100", totalAmountCents: "100100" };
    const s: Session = { id: requiredText(p.stripeSessionId), metadata, amount_total: 100100, status, payment_status: "unpaid", url: "https://isolated.invalid/pay", payment_intent: null };
    const intent: Intent = { id: "pi-" + id, status: "processing", metadata, currency: "usd", amount: 100100,
      payment_method_types: ["us_bank_account"], transfer_data: { destination: "acct" }, on_behalf_of: "acct" };
    rows.push(p); sessions.set(s.id, s); intents.set(intent.id, intent); return { p, s, intent };
  }
  return { helper, db, rows, identity, sessions, intents, calls, control, stripe, add,
    inspect: () => helper.inspectTenantCheckoutAttempts(db, identity),
    guard: (snapshot: CheckoutInspection) => helper.assertCheckoutReductionAllowed(db, snapshot) };
}
