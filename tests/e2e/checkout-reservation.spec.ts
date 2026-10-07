import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

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
      if ("gt" in wanted) return row[key] != null && row[key] > wanted.gt;
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
  client.tenantAssignment = { findFirst: async ({ where }: any) => match({ id: "historical", propertyId: "property", unitId: "unit", isCurrent: true, moveOutDate: null }, where) ? { id: "historical" } : null };
  client.property = { updateMany: async ({ where, data }: any) => { if (match(db.property, where)) Object.assign(db.property, data); return { count: 1 }; } };
  let committedPayments: any[] = [];
  let tail = Promise.resolve();
  const lockKeys: string[] = [];
  client.$transaction = async (fn: any) => {
    let release: (() => void) | undefined; let snapshot: any;
    const tx = { ...client, $executeRaw: async (_strings: any, key: string) => {
      lockKeys.push(key);
      if (!release) {
        const predecessor = tail; tail = new Promise<void>(r => { release = r; });
        await predecessor; snapshot = structuredClone(db); committedPayments = structuredClone(db.payments);
      }
    } };
    try { const result = await fn(tx); committedPayments = structuredClone(db.payments); return result; } catch (error) { if (snapshot) db = snapshot; throw error; } finally { release?.(); }
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
  const responses = { NextResponse: { json: (body: any, options?: any) => ({ body, status: options?.status ?? 200 }) } };
  const webhook = sourceModule("app/api/stripe/webhook/route.ts", {
    "next/server": responses, stripe: FakeStripe, "next/headers": { headers: async () => ({ get: () => "signature" }) },
    "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: client },
    "@/lib/paymentStatus": status, "@/lib/rentDates": { getBusinessDate: () => date },
    "@/lib/realtime": { emitEvent() {} }, "@/lib/liveGating": { canMakePayments: () => true },
  });
  const ledger = sourceModule("lib/ledger.ts", { "@/lib/prisma": { prisma: client } });
  const checkout = () => sourceModule("app/api/payments/create-session/route.ts", {
    "next/server": responses, stripe: FakeStripe, "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: client },
    "@/lib/session": { getSession: async () => ({ role: "TENANT", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical" }), refreshSessionCookie: async () => {} },
    "@/lib/checkoutCollectibility": sourceModule("lib/checkoutCollectibility.ts", { stripe: FakeStripe }),
    "@/lib/paymentStatus": status, "@/lib/liveGating": { canMakePayments: () => true }, "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
    "@/lib/unitFinancialState": { getUnitFinancialState: async () => {
      const balance = db.useLedgerBalance ? (await ledger.getUnitLedgerSummary({
        unitId: "unit", tenantAssignmentId: "historical", asOf: new Date("2030-01-01"),
      })).balanceCents : db.balance;
      return { ledgerBalanceCents: balance, processingFeeCents: db.fee,
        tenantTotalDueCents: balance + db.fee, billingCycle: "2026-10",
        hasPendingPayment: committedPayments.some((p: any) => p.status === "PENDING") };
    } },
  });
  const event = (type = "payment_intent.succeeded") => ({
    id: "event", type, data: { object: type.startsWith("checkout.") ? { id: "cs", payment_intent: "pi", metadata } :
      type.startsWith("charge.dispute.") ? { id: "du", charge: "ch", payment_intent: "pi" } :
      type === "charge.refunded" ? { id: "ch", payment_intent: "pi" } : structuredClone(intent) },
  });
  return { db: () => db, payment: () => db.payments[0], intent, refunds, disputes, sessions, creations, lockKeys,
    webhook, ledger, checkout, event, stripe, unit,
    timeout: () => { timeoutOnce = true; },
    apply: async (type?: string) => {
      const response = await webhook.POST({ text: async () => JSON.stringify(event(type)) });
      if (response.status !== 200 || response.body.reconciled === false) {
        throw new Error(response.body.error ?? "Financial event rejected");
      }
      expect(response.body.received).toBe(true);
    },
    balance: async () => (await ledger.getUnitLedgerSummary({ unitId: "unit", tenantAssignmentId: "historical", asOf: new Date("2030-01-01") })).balanceCents,
    request: () => ({ headers: { get: () => "isolated" } }),
  };
}

async function start(f: ReturnType<typeof fixture>) {
  const response = await f.checkout().POST(f.request());
  if (response.status !== 200) throw new Error(response.body.error);
  expect(response.body.ok).toBe(true);
  return response.body.data.url;
}
function fresh() { const f = fixture(); f.db().payments = []; return f; }
test("sequential Pay clicks and second tab reuse one Checkout", async () => {
  const f = fresh(); const first = await start(f); const second = await start(f);
  expect(second).toBe(first); expect(f.db().payments).toHaveLength(1); expect(f.creations).toHaveLength(1);
});
test("parallel starts serialize one collectible reservation", async () => {
  const f = fresh(); const urls = await Promise.all([start(f), start(f), start(f)]);
  expect(new Set(urls).size).toBe(1); expect(f.db().payments).toHaveLength(1); expect(f.creations).toHaveLength(1);
  expect(f.lockKeys).toContain("property:unit:historical");
});
test("balance/property name changes never reprice an open Checkout", async () => {
  const f = fresh(); await start(f); const quote = structuredClone(f.creations[0]);
  f.db().balance = 175000; f.unit.property.name = "Changed";
  await start(f); expect(f.creations).toHaveLength(1); expect(f.creations[0]).toEqual(quote);
});
test("decreased debt fails closed without returning obsolete URL or creating replacement", async () => {
  const f = fresh(); await start(f); f.db().balance = 50000;
  const result = await f.checkout().POST(f.request());
  expect(result.status).toBe(409); expect(result.body.data).toBeUndefined();
  expect(f.creations).toHaveLength(1); expect(f.db().payments).toHaveLength(1);
});
test("FAILED with open Checkout remains protected", async () => {
  const f = fresh(); const url = await start(f); f.payment().status = "FAILED";
  expect(await start(f)).toBe(url); expect(f.creations).toHaveLength(1);
});
test("expired Checkout is replaced at current balance", async () => {
  const f = fresh(); await start(f); f.sessions.get(f.payment().stripeSessionId).status = "expired";
  f.db().balance = 175000; await start(f);
  expect(f.db().payments).toHaveLength(2); expect(f.creations).toHaveLength(2);
  expect(f.creations[1].params.metadata.ledgerBalanceCents).toBe("175000");
});
test("complete Checkout with processing Intent is not replaced", async () => {
  const f = fresh(); await start(f);
  const session = f.sessions.get(f.payment().stripeSessionId); session.status = "complete"; session.payment_intent = "pi";
  f.intent.status = "processing"; await expect(start(f)).rejects.toThrow("processing");
  expect(f.db().payments).toHaveLength(1); expect(f.creations).toHaveLength(1);
});
test("complete Checkout with canceled Intent permits replacement", async () => {
  const f = fresh(); await start(f); const session = f.sessions.get(f.payment().stripeSessionId);
  session.status = "complete"; session.payment_intent = "pi"; f.intent.metadata = f.creations[0].params.metadata; f.intent.status = "canceled";
  await start(f); expect(f.creations).toHaveLength(2);
});
test("ambiguous timeout recovers same Payment with identical parameters/key/timestamp", async () => {
  const f = fresh(); f.timeout(); await expect(start(f)).rejects.toThrow("Failed to create payment session");
  const original = structuredClone(f.creations[0]); f.db().balance = 175000; f.unit.property.name = "Changed";
  await start(f); expect(f.db().payments).toHaveLength(1); expect(f.creations).toHaveLength(2);
  expect(f.creations[1]).toEqual(original);
});
test("old unresolved reservation fails closed", async () => {
  const f = fresh(); f.timeout(); await expect(start(f)).rejects.toThrow();
  f.payment().createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await expect(start(f)).rejects.toThrow("cannot safely"); expect(f.creations).toHaveLength(1);
});
test("multiple pre-existing collectible Checkouts never create another", async () => {
  const f = fresh(); await start(f);
  const duplicate = { ...structuredClone(f.payment()), id: "duplicate", stripeSessionId: "duplicate-cs" };
  const session = { ...structuredClone(f.sessions.get(f.payment().stripeSessionId)), id: "duplicate-cs",
    metadata: { ...f.sessions.get(f.payment().stripeSessionId).metadata, paymentId: "duplicate" } };
  f.db().payments.push(duplicate); f.sessions.set("duplicate-cs", session);
  await expect(start(f)).rejects.toThrow("Multiple"); expect(f.creations).toHaveLength(1);
});
test("wrong existing Checkout identity fails closed", async () => {
  const f = fresh(); await start(f); f.sessions.get(f.payment().stripeSessionId).metadata.unitId = "other";
  const response = await f.checkout().POST(f.request());
  expect(response.status).toBe(409); expect(response.body.ok).toBe(false);
  expect(response.body.error).toBe("A payment is processing or awaiting authoritative reconciliation.");
  expect(response.body.data).toBeUndefined(); expect(f.creations).toHaveLength(1);
  expect(f.db().payments).toHaveLength(1);
  expect(response.body.error).not.toContain(f.payment().stripeSessionId);
  expect(response.body.error).not.toContain("other");
});
test("success races start: processing/successful Stripe state prevents replacement", async () => {
  const f = fresh(); await start(f);
  const session = f.sessions.get(f.payment().stripeSessionId); session.status = "complete"; session.payment_intent = "pi";
  f.intent.status = "succeeded";
  await expect(start(f)).rejects.toThrow("reconciliation"); expect(f.creations).toHaveLength(1);
});
test("settlement committed before retry wins over new reservation", async () => {
  const f = fresh(); await start(f); f.intent.metadata = f.creations[0].params.metadata;
  await f.apply(); f.db().balance = await f.balance();
  await expect(start(f)).rejects.toThrow("No balance"); expect(f.creations).toHaveLength(1);
});
test("webhook failure plus retry/start share serialization without extra collection", async () => {
  const f = fresh(); await start(f); f.intent.metadata = f.creations[0].params.metadata;
  f.db().failAudit = true; await expect(f.apply()).rejects.toThrow();
  f.db().failAudit = false; await f.apply(); f.db().balance = await f.balance();
  await expect(start(f)).rejects.toThrow("No balance"); expect(f.db().ledger.filter((e: any) => e.entryType === "PAYMENT")).toHaveLength(1);
});

test("canceled PENDING attempt commits retirement before the financial SSOT quotes replacement", async () => {
  const f = fresh(); await start(f);
  f.payment().status = "PENDING";
  const session = f.sessions.get(f.payment().stripeSessionId);
  session.status = "complete"; session.payment_intent = "pi";
  f.intent.metadata = f.creations[0].params.metadata;
  f.intent.status = "canceled";
  await start(f);
  expect(f.db().payments[0].status).toBe("FAILED");
  expect(f.creations).toHaveLength(2);
});

test("concurrent exported settlement and Pay requests cannot create a second collectible attempt", async () => {
  const f = fresh(); await start(f);
  f.intent.metadata = f.creations[0].params.metadata;
  f.db().useLedgerBalance = true;
  const results = await Promise.allSettled([f.apply(), start(f)]);
  expect(results[0].status).toBe("fulfilled");
  expect(f.creations).toHaveLength(1);
  expect(f.db().payments).toHaveLength(1);
  expect(await f.balance()).toBe(0);
  expect(f.db().ledger.filter((e: any) => e.entryType === "PAYMENT")).toHaveLength(1);
});
