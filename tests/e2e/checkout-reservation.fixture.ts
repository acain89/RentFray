import { financialModule } from "./financial-vm.fixture";
import { stripeProvider } from "./stripe-provider.fixture";

import { paymentClient, type PaymentDatabase, type StoredPayment } from "./payment-database.fixture";
import { expect } from "@playwright/test";





export function fixture(fee = 0, environment?: Parameters<typeof financialModule>[1]) {
  const sourceModule = financialModule("mock", environment);
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
  let committedPayments: StoredPayment[] = [];
  const { client, unit, lockKeys } = paymentClient(() => db, value => { db = value; }, { date, greaterThan: true, currentAssignment: true, onCommitted: rows => { committedPayments = rows; } });
  const metadata = { paymentId: "payment", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical",
    stripeAccountId: "acct", billingCycle: "2026-10", ledgerBalanceCents: "150000", processingFeeCents: String(fee), totalAmountCents: String(150000 + fee) };
  const { stripe, intent, refunds, disputes, sessions, creations, timeout } = stripeProvider(fee, metadata);
  class StripeError extends Error {}
  class FakeStripe { static errors = { StripeError }; constructor() { return stripe; } }
  const status = sourceModule("lib/paymentStatus.ts", {});
  const responses = { NextResponse: { json: (body: unknown, options?: { status?: number; headers?: HeadersInit }) => ({ body, status: options?.status ?? 200 }) } };
  const webhook = sourceModule("app/api/stripe/webhook/route.ts", {
    "@/lib/stripeAccountStatus": { reconcileStripeAccountStatus: async () => { throw new Error("Unexpected account reconciliation in financial test"); } },
    "next/server": responses, stripe: FakeStripe, "next/headers": { headers: async () => ({ get: () => "signature" }) },
    "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: client },
    "@/lib/paymentStatus": status, "@/lib/rentDates": { getBusinessDate: () => date, getBusinessDateInstant: sourceModule("lib/rentDates.ts", {}).getBusinessDateInstant },
    "@/lib/realtime": { emitEvent() {} }, "@/lib/liveGating": { canMakePayments: () => true },
  });
  const ledger = sourceModule("lib/ledger.ts", { "@/lib/prisma": { prisma: client } });
  const checkout = () => sourceModule("app/api/payments/create-session/route.ts", {
    "next/server": responses, stripe: FakeStripe, "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: client },
    "@/lib/session": { SessionAuthorizationError: sourceModule("lib/session.ts", { crypto: {}, "next/headers": {}, "@/lib/prisma": {} }).SessionAuthorizationError, getSession: async () => ({ role: "TENANT", propertyId: "property", unitId: "unit", tenantAssignmentId: "historical" }), refreshSessionCookie: async () => {} },
    "@/lib/checkoutCollectibility": sourceModule("lib/checkoutCollectibility.ts", { stripe: FakeStripe }),
    "@/lib/paymentStatus": status, "@/lib/liveGating": { canMakePayments: () => true }, "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
    "@/lib/unitFinancialState": { getUnitFinancialState: async () => {
      const balance = db.useLedgerBalance ? (await ledger.getUnitLedgerSummary({
        unitId: "unit", tenantAssignmentId: "historical", asOf: new Date("2030-01-01"),
      })).balanceCents : db.balance;
      return { ledgerBalanceCents: balance, processingFeeCents: db.fee,
        tenantTotalDueCents: balance + db.fee, billingCycle: "2026-10",
        hasPendingPayment: committedPayments.some((p) => p.status === "PENDING") };
    } },
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

