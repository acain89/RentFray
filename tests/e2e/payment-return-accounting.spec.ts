import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function sourceModule(path: string, imports: Record<string, any>, suffix = "") {
  const module = { exports: {} as Record<string, any> };
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "../..", path), "utf8") + suffix, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, Buffer, URL, Date, Set, Map,
    process: { env: { NODE_ENV: "production", STRIPE_SECRET_KEY: "isolated", STRIPE_WEBHOOK_SECRET: "isolated" } },
    console: { log() {}, error() {} },
    require(name: string) { if (!(name in imports)) throw new Error("Unexpected import " + name); return imports[name]; },
  });
  return module.exports;
}
function match(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, wanted]: [string, any]) => {
    if (key === "OR") return wanted.some((part: any) => match(row, part));
    if (key === "AND") return wanted.every((part: any) => match(row, part));
    if (wanted && typeof wanted === "object" && !(wanted instanceof Date)) {
      if ("in" in wanted) return wanted.in.includes(row[key]);
      if ("not" in wanted) return row[key] !== wanted.not;
      if ("lte" in wanted) return row[key] <= wanted.lte;
    }
    return row[key] === wanted;
  });
}
function fixture(fee = 0) {
  let db: any = { payments: [], ledger: [], audits: [], property: { id: "property", status: "READY", isActive: true },
    balance: 150000, fee, failAudit: false };
  const date = new Date();
  const payment = { id: "payment", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical",
    billingCycle: "2026-10", amountCents: 150000, processingFeeCents: fee,
    stripePaymentIntentId: "pi", stripeSessionId: "cs", status: "UNPAID", paidAt: null,
    paymentMethod: "ACH", createdAt: date };
  db.payments.push(payment);
  db.ledger.push({ id: "rent", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical",
    entryType: "CHARGE", chargeType: "RENT", amountCents: 150000, paymentId: null,
    effectiveDate: new Date("2026-10-01"), createdAt: date, voidedAt: null, billingCycle: "2026-10" });
  let sequence = 0;
  const client: any = {};
  for (const [model, table] of [["payment", "payments"], ["ledgerEntry", "ledger"], ["auditLog", "audits"]]) {
    client[model] = {
      findFirst: async (args: any) => structuredClone(db[table].find((row: any) => match(row, args.where)) ?? null),
      findUnique: async (args: any) => structuredClone(db[table].find((row: any) => match(row, args.where)) ?? null),
      findMany: async (args: any = {}) => db[table].filter((row: any) => match(row, args.where)).map((row: any) => ({
        ...structuredClone(row), ...(table === "ledger" ? { payment: row.paymentId ? { status: db.payments.find((p: any) => p.id === row.paymentId)?.status } : null } : {}),
      })),
      create: async ({ data }: any) => {
        if (table === "audits" && db.failAudit) throw new Error("Injected DB failure");
        if (data.idempotencyKey && db[table].some((r: any) => r.idempotencyKey === data.idempotencyKey)) throw new Error("Unique ledger key");
        const row = { id: "new-" + ++sequence, createdAt: date, voidedAt: null, ...structuredClone(data) };
        db[table].push(row); return structuredClone(row);
      },
      update: async ({ where, data }: any) => {
        const row = db[table].find((r: any) => match(r, where)); if (!row) throw new Error("Not found");
        Object.assign(row, structuredClone(data)); return structuredClone(row);
      },
      updateMany: async ({ where, data }: any) => {
        const rows = db[table].filter((r: any) => match(r, where)); rows.forEach((r: any) => Object.assign(r, structuredClone(data)));
        return { count: rows.length };
      },
      upsert: async ({ where, create, update }: any) => {
        const row = db[table].find((r: any) => match(r, where));
        return row ? client[model].update({ where, data: update }) : client[model].create({ data: create });
      },
    };
  }
  const unit = { id: "unit", unitNumber: "1", propertyId: "property", tier: null, tenantAssignments: [{ id: "historical" }],
    property: { ...db.property, name: "Test", stripeAccountId: "acct", settings: {}, paymentStatus: {}, units: [], rentFrayStartDate: null } };
  client.unit = { findFirst: async ({ where }: any) => match(unit, where) ? structuredClone(unit) : null };
  client.tenantAssignment = { findFirst: async ({ where }: any) => match({ id: "historical", propertyId: "property", unitId: "unit" }, where) ? { id: "historical" } : null };
  client.property = { updateMany: async ({ where, data }: any) => { if (match(db.property, where)) Object.assign(db.property, data); return { count: 1 }; } };
  let tail = Promise.resolve();
  const lockKeys: string[] = [];
  client.$transaction = async (fn: any) => {
    let release: (() => void) | undefined; let snapshot: any;
    const tx = { ...client, $executeRaw: async (_strings: any, key: string) => {
      lockKeys.push(key);
      if (!release) {
        const predecessor = tail; tail = new Promise<void>(r => { release = r; });
        await predecessor; snapshot = structuredClone(db);
      }
    } };
    try { return await fn(tx); } catch (error) { if (snapshot) db = snapshot; throw error; } finally { release?.(); }
  };
  const metadata = { paymentId: "payment", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical",
    stripeAccountId: "acct", billingCycle: "2026-10", ledgerBalanceCents: "150000", processingFeeCents: String(fee), totalAmountCents: String(150000 + fee) };
  const intent: any = { id: "pi", status: "succeeded", amount: 150000 + fee, amount_received: 150000 + fee,
    currency: "usd", metadata, payment_method_types: ["us_bank_account"], latest_charge: "ch", on_behalf_of: "acct",
    transfer_data: { destination: "acct" }, last_payment_error: null };
  const refunds: any[] = []; const disputes: any[] = [];
  const sessions = new Map<string, any>();
  const creations: any[] = []; let timeoutOnce = false;
  const keys = new Map<string, any>();
  const iterable = (rows: any[]) => ({ async *[Symbol.asyncIterator]() { for (const row of rows) yield structuredClone(row); } });
  const stripe: any = {
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    paymentIntents: { retrieve: async () => structuredClone(intent) },
    charges: { retrieve: async () => ({ id: "ch", payment_intent: "pi", currency: "usd", amount: intent.amount, payment_method_details: { type: "us_bank_account" } }) },
    refunds: { list: () => iterable(refunds) },
    disputes: { list: () => iterable(disputes), retrieve: async (id: string) => structuredClone(disputes.find(d => d.id === id)) },
    checkout: { sessions: {
      retrieve: async (id: string) => { if (!sessions.has(id)) throw new Error("Unknown Checkout"); return structuredClone(sessions.get(id)); },
      create: async (params: any, options: any) => {
        const key = options.idempotencyKey; creations.push({ params: structuredClone(params), key });
        if (keys.has(key)) {
          expect(params).toEqual(keys.get(key).params); return structuredClone(keys.get(key).session);
        }
        const session = { id: "checkout-" + keys.size, status: "open", url: "https://isolated.invalid/pay", payment_intent: null, metadata: structuredClone(params.metadata), amount_total: params.line_items.reduce((sum: number, item: any) => sum + item.price_data.unit_amount, 0) };
        keys.set(key, { params: structuredClone(params), session }); sessions.set(session.id, session);
        if (timeoutOnce) { timeoutOnce = false; throw new Error("Ambiguous timeout AFTER Stripe created Session"); }
        return structuredClone(session);
      },
    } },
  };
  class StripeError extends Error {}
  class FakeStripe { static errors = { StripeError }; constructor() { return stripe; } }
  const status = sourceModule("lib/paymentStatus.ts", {});
  const responses = { NextResponse };
  const webhook = sourceModule("app/api/stripe/webhook/route.ts", {
    "next/server": responses, stripe: FakeStripe, "next/headers": { headers: async () => ({ get: () => "signature" }) },
    "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: client },
    "@/lib/stripeAccountStatus": { reconcileStripeAccountStatus: async () => { throw new Error("Unexpected account reconciliation in financial test"); } },
    "@/lib/paymentStatus": status, "@/lib/rentDates": { getBusinessDate: () => new Date(2026, 9, 5), getBusinessDateInstant: sourceModule("lib/rentDates.ts", {}).getBusinessDateInstant },
    "@/lib/realtime": { emitEvent() {} }, "@/lib/liveGating": { canMakePayments: () => true },
  });
  const ledger = sourceModule("lib/ledger.ts", { "@/lib/prisma": { prisma: client } });
  const checkout = () => sourceModule("app/api/payments/create-session/route.ts", {
    "next/server": responses, stripe: FakeStripe, "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: client },
    "@/lib/session": { getSession: async () => ({ role: "TENANT", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical" }), refreshSessionCookie: async () => {} },
    "@/lib/stripeAccountStatus": { reconcileStripeAccountStatus: async () => { throw new Error("Unexpected account reconciliation in financial test"); } },
    "@/lib/paymentStatus": status, "@/lib/liveGating": { canMakePayments: () => true }, "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
    "@/lib/unitFinancialState": { getUnitFinancialState: async () => ({ ledgerBalanceCents: db.balance, processingFeeCents: db.fee,
      tenantTotalDueCents: db.balance + db.fee, billingCycle: "2026-10", hasPendingPayment: false }) },
  });
  const event = (type = "payment_intent.succeeded") => ({
    id: "event", type, data: { object: type.startsWith("checkout.") ? { id: "cs", payment_intent: "pi", metadata } :
      type.startsWith("charge.dispute.") ? { id: "du", charge: "ch", payment_intent: "pi" } :
      type.startsWith("refund.") || type === "charge.refund.updated" ? { id: "r", charge: "ch", payment_intent: "pi" } :
      type === "charge.refunded" ? { id: "ch", payment_intent: "pi" } : structuredClone(intent) },
  });
  return { db: () => db, payment: () => db.payments[0], intent, refunds, disputes, sessions, creations, lockKeys,
    webhook, ledger, checkout, event, stripe, unit,
    timeout: () => { timeoutOnce = true; },
    apply: async (type?: string) => {
      const response = await webhook.POST({ text: async () => JSON.stringify(event(type)) });
      const body = await response.json();
      if (response.status !== 200 || body.reconciled === false) {
        throw new Error(body.error ?? "Financial event rejected");
      }
      expect(body.received).toBe(true);
    },
    balance: async () => (await ledger.getUnitLedgerSummary({ unitId: "unit", tenantAssignmentId: "historical", asOf: new Date("2030-01-01") })).balanceCents,
    request: () => ({ headers: { get: () => "isolated" } }),
  };
}

test("full ACH withdrawal restores exactly principal, excluding all payment/dispute fees", async () => {
  const f = fixture(2500); await f.apply(); expect(await f.balance()).toBe(0);
  f.disputes.push({ id: "du", charge: "ch", balance_transactions: [{ id: "withdraw", currency: "usd", amount: -152500, fee: 1500, net: -154000 }] });
  await f.apply("charge.dispute.funds_withdrawn");
  expect(f.payment().status).toBe("REVERSED"); expect(await f.balance()).toBe(150000);
  expect(f.db().ledger.filter((e: any) => e.entryType === "ADJUSTMENT" && !e.voidedAt)).toHaveLength(0);
});
test("duplicate/concurrent withdrawal and reinstatement apply once", async () => {
  const f = fixture(2500); await f.apply();
  f.disputes.push({ id: "du", charge: "ch", balance_transactions: [{ id: "withdraw", currency: "usd", amount: -152500 }] });
  await Promise.all([f.apply("charge.dispute.funds_withdrawn"), f.apply("charge.dispute.funds_withdrawn")]);
  expect(await f.balance()).toBe(150000);
  f.disputes[0].balance_transactions.push({ id: "reinstate", currency: "usd", amount: 152500 });
  await Promise.all([f.apply("charge.dispute.funds_reinstated"), f.apply("charge.dispute.funds_reinstated")]);
  expect(await f.balance()).toBe(0); expect(f.payment().status).toBe("PAID");
});
test("dispute creation without movement does not restore debt", async () => {
  const f = fixture(); await f.apply(); f.disputes.push({ id: "du", charge: "ch", balance_transactions: [], status: "warning_needs_response" });
  await f.apply("charge.dispute.created"); expect(await f.balance()).toBe(0); expect(f.payment().status).toBe("PAID");
});
test("partial and cumulative fee-free returns preserve remaining credit", async () => {
  const f = fixture(); await f.apply(); f.refunds.push({ id: "refund-a", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
  await f.apply("charge.refunded"); await f.apply("charge.refunded");
  expect(await f.balance()).toBe(50000); expect(f.payment().status).toBe("PAID");
  f.refunds.push({ id: "refund-b", charge: "ch", currency: "usd", status: "succeeded", amount: 25000 });
  await f.apply("charge.refunded"); expect(await f.balance()).toBe(75000);
  expect(f.db().ledger.filter((e: any) => e.entryType === "ADJUSTMENT" && !e.voidedAt)).toHaveLength(1);
});
test("partial -> full return removes partial adjustment without double restoration", async () => {
  const f = fixture(); await f.apply(); f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
  await f.apply("charge.refunded"); f.refunds[0].amount = 150000;
  await f.apply("charge.refunded"); await f.apply("charge.refunded");
  expect(await f.balance()).toBe(150000); expect(f.payment().status).toBe("REVERSED");
});
for (const status of ["pending", "failed", "canceled"]) {
  test(`external ${status} refund does not restore debt`, async () => {
    const f = fixture(); await f.apply(); f.refunds.push({ id: "r", charge: "ch", currency: "usd", status, amount: 150000 });
    await f.apply("charge.refunded"); expect(await f.balance()).toBe(0); expect(f.payment().status).toBe("PAID");
  });
}
test("ambiguous partial bundled-fee allocation fails without financial writes", async () => {
  const f = fixture(2500); await f.apply(); f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
  const before = structuredClone(f.db()); await expect(f.apply("charge.refunded")).rejects.toThrow("Financial event requires reconciliation");
  expect(f.db()).toEqual(before);
});

for (const type of ["charge.refunded", "charge.refund.updated", "refund.created", "refund.updated", "refund.failed"]) {
  test(`${type}: ambiguous fee-bearing return is HTTP 503 on duplicate delivery`, async () => {
    const f = fixture(995); await f.apply();
    f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
    const before = structuredClone(f.db());
    for (let delivery = 0; delivery < 2; delivery++) {
      const response = await f.webhook.POST({ text: async () => JSON.stringify(f.event(type)) });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Financial event requires reconciliation" });
      expect(f.db()).toEqual(before);
    }
  });
}

for (const type of ["charge.refund.updated", "refund.updated"]) {
  test(`${type}: pending refund becoming successful is inspected`, async () => {
    const f = fixture(995); await f.apply();
    f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "pending", amount: 50000 });
    await f.apply("charge.refunded");
    const before = structuredClone(f.db());
    f.refunds[0].status = "succeeded";
    const response = await f.webhook.POST({ text: async () => JSON.stringify(f.event(type)) });
    expect(response.status).toBe(503); expect(f.db()).toEqual(before);
    // A later full return is unambiguous and remains idempotently recoverable.
    f.refunds[0].amount = 150995;
    await f.apply(type); await f.apply(type);
    expect(f.payment().status).toBe("REVERSED"); expect(await f.balance()).toBe(150000);
  });
}

test("unrelated events and permanently invalid refund mappings are acknowledged without writes", async () => {
  const f = fixture(); const before = structuredClone(f.db());
  const unrelated = await f.webhook.POST({ text: async () => JSON.stringify(f.event("customer.updated")) });
  expect(unrelated.status).toBe(200); expect(await unrelated.json()).toEqual({ received: true });
  const event = f.event("refund.updated"); event.data.object.payment_intent = "unrelated";
  const invalid = await f.webhook.POST({ text: async () => JSON.stringify(event) });
  expect(invalid.status).toBe(200); expect(await invalid.json()).toEqual({ received: true, reconciled: false });
  expect(f.db()).toEqual(before);
});
test("stale success after withdrawal uses current funds state, not old success", async () => {
  const f = fixture(); await f.apply(); f.disputes.push({ id: "du", charge: "ch", balance_transactions: [{ id: "w", currency: "usd", amount: -150000 }] });
  await f.apply("charge.dispute.funds_withdrawn"); await f.apply();
  expect(await f.balance()).toBe(150000); expect(f.payment().status).toBe("REVERSED");
});

test("full successful refund neutralizes the original fee and restores principal only once", async () => {
  const f = fixture(2500); await f.apply();
  f.refunds.push({ id: "full", charge: "ch", currency: "usd", status: "succeeded", amount: 152500 });
  await f.apply("charge.refunded"); await f.apply("charge.refunded");
  expect(await f.balance()).toBe(150000);
  expect(f.payment().status).toBe("REVERSED");
});
test("stale withdrawal delivered after reinstatement uses current restored funds", async () => {
  const f = fixture(2500); await f.apply();
  f.disputes.push({ id: "du", charge: "ch", balance_transactions: [
    { id: "w", currency: "usd", amount: -152500 }, { id: "r", currency: "usd", amount: 152500 },
  ] });
  await f.apply("charge.dispute.funds_reinstated");
  await f.apply("charge.dispute.funds_withdrawn");
  expect(await f.balance()).toBe(0); expect(f.payment().status).toBe("PAID");
});
