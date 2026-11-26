import { financialModule } from "./financial-vm.fixture";
import { stripeProvider } from "./stripe-provider.fixture";

import { paymentClient, type PaymentDatabase, type StoredPayment } from "./payment-database.fixture";
import { test, expect } from "@playwright/test";





const sourceModule = financialModule("mock");
function fixture(fee = 0) {
  let db: PaymentDatabase = { payments: [], ledger: [], audits: [], property: { id: "property", status: "READY", isActive: true },
    balance: 150000, fee, failAudit: false };
  const date = new Date();
  const payment: StoredPayment = { id: "payment", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical",
    billingCycle: "2026-10", amountCents: 150000, processingFeeCents: fee,
    stripePaymentIntentId: "pi", stripeSessionId: "cs", status: "UNPAID", paidAt: null,
    paymentMethod: "ACH", createdAt: date };
  db.payments.push(payment);
  db.ledger.push({ id: "rent", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical",
    entryType: "CHARGE", chargeType: "RENT", amountCents: 150000, paymentId: null,
    effectiveDate: new Date("2026-10-01"), createdAt: date, voidedAt: null, billingCycle: "2026-10" });
  const { client, unit, lockKeys } = paymentClient(() => db, value => { db = value; }, { date, greaterThan: false, currentAssignment: false });
  const metadata = { paymentId: "payment", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical",
    stripeAccountId: "acct", billingCycle: "2026-10", ledgerBalanceCents: "150000", processingFeeCents: String(fee), totalAmountCents: String(150000 + fee) };
  const { stripe, intent, refunds, disputes, sessions, creations, timeout } = stripeProvider(fee, metadata);
  class StripeError extends Error {}
  class FakeStripe { static errors = { StripeError }; constructor() { return stripe; } }
  const status = sourceModule("lib/paymentStatus.ts", {});
  const responses = { NextResponse: { json: (body: unknown, options?: { status?: number; headers?: HeadersInit }) => ({ body, status: options?.status ?? 200 }) } };
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
      type === "charge.refunded" ? { id: "ch", payment_intent: "pi" } : structuredClone(intent) },
  });
  return { db: () => db, payment: () => db.payments[0], intent, refunds, disputes, sessions, creations, lockKeys,
    webhook, ledger, checkout, event, stripe, unit,
    timeout,
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

for (const startingStatus of ["UNPAID", "PENDING", "FAILED"] as const) {
  test(`authoritative success from ${startingStatus}`, async () => {
    const f = fixture(); f.payment().status = startingStatus; await f.apply();
    expect(f.payment().status).toBe("PAID"); expect(await f.balance()).toBe(0);
  });
}
test("duplicate and concurrent success have one ledger credit", async () => {
  const f = fixture(); await Promise.all([f.apply(), f.apply()]); await f.apply();
  expect(f.db().ledger.filter((e) => e.entryType === "PAYMENT")).toHaveLength(1);
  expect(await f.balance()).toBe(0); expect(f.lockKeys).toContain("property:unit:historical");
});
for (const type of ["payment_intent.processing", "checkout.session.completed", "payment_intent.payment_failed", "checkout.session.async_payment_failed"]) {
  test(`PAID survives stale ${type}`, async () => {
    const f = fixture(); await f.apply(); f.intent.status = "processing"; await f.apply(type);
    expect(f.payment().status).toBe("PAID"); expect(await f.balance()).toBe(0);
  });
}
for (const mismatch of ["amount", "propertyId", "unitId", "tenantAssignmentId", "billingCycle", "intentId", "destination"]) {
  test(`identity mismatch ${mismatch} causes no writes`, async () => {
    const f = fixture(); const before = structuredClone(f.db());
    if (mismatch === "amount") f.intent.amount++;
    else if (mismatch === "intentId") f.payment().stripePaymentIntentId = "other";
    else if (mismatch === "destination") f.intent.transfer_data.destination = "other";
    else f.intent.metadata[mismatch] = "other";
    const snapshot = structuredClone(f.db());
    await expect(f.apply()).rejects.toThrow();
    expect(f.db()).toEqual(snapshot); expect(f.db().ledger).toEqual(before.ledger);
  });
}
test("historical assignment and later inactive readiness do not block collection", async () => {
  const f = fixture(); f.db().property.isActive = false; f.db().property.status = "INACTIVE";
  await f.apply(); expect(f.payment().tenantAssignmentId).toBe("historical");
  expect(f.db().ledger.find((e) => e.entryType === "PAYMENT")?.tenantAssignmentId).toBe("historical");
  expect(await f.balance()).toBe(0);
});
test("internal audit failure rolls back all financial writes", async () => {
  const f = fixture(); f.db().failAudit = true; const before = structuredClone(f.db());
  await expect(f.apply()).rejects.toThrow("Webhook reconciliation failed"); expect(f.db()).toEqual(before);
});
test("failure before collection writes no restoration", async () => {
  const f = fixture(); f.intent.status = "requires_payment_method"; f.intent.last_payment_error = { code: "failed" };
  await f.apply("payment_intent.payment_failed"); expect(f.payment().status).toBe("FAILED");
  expect(await f.balance()).toBe(150000); expect(f.db().ledger).toHaveLength(1);
});
test("retryable webhook error receives non-2xx; invalid mapping is acknowledged without writes", async () => {
  const f = fixture(); f.db().failAudit = true;
  const response = await f.webhook.POST({ text: async () => JSON.stringify(f.event()) });
  expect(response.status).toBe(500);
  f.db().failAudit = false; f.intent.metadata.unitId = "wrong";
  const invalid = await f.webhook.POST({ text: async () => JSON.stringify(f.event()) });
  expect(invalid.status).toBe(200); expect(invalid.body.reconciled).toBe(false);
});
test("harmless duplicate webhook is acknowledged", async () => {
  const f = fixture(); await f.apply();
  const response = await f.webhook.POST({ text: async () => JSON.stringify(f.event("payment_intent.processing")) });
  expect(response.status).toBe(200); expect(f.payment().status).toBe("PAID");
});

test("Stripe retrieval transport failure requests retry without financial writes", async () => {
  const f = fixture(); const before = structuredClone(f.db());
  f.stripe.paymentIntents.retrieve = async () => { throw new Error("Transport unavailable"); };
  const response = await f.webhook.POST({ text: async () => JSON.stringify(f.event()) });
  expect(response.status).toBe(500); expect(f.db()).toEqual(before);
});
