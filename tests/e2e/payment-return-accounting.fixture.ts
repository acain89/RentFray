import { financialModule } from "./financial-vm.fixture";
import { stripeProvider, type EventObject } from "./stripe-provider.fixture";

import { paymentClient, type PaymentDatabase, type StoredPayment } from "./payment-database.fixture";
import { expect } from "@playwright/test";




import { NextResponse } from "next/server";

const sourceModule = financialModule("json");
export function fixture(fee = 0, getSignature:()=>string=()=>"signature") {
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
  const responses = { NextResponse };
  const webhook = sourceModule("app/api/stripe/webhook/route.ts", {
    "next/server": responses, stripe: FakeStripe, "next/headers": { headers: async () => ({ get: getSignature }) },
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
  const event = (type = "payment_intent.succeeded"): { id: string; type: string; data: { object: EventObject } } => ({
    id: "event", type, data: { object: type.startsWith("checkout.") ? { id: "cs", payment_intent: "pi", metadata } :
      type.startsWith("charge.dispute.") ? { id: "du", charge: "ch", payment_intent: "pi" } :
      type.startsWith("refund.") || type === "charge.refund.updated" ? { id: "r", charge: "ch", payment_intent: "pi" } :
      type === "charge.refunded" ? { id: "ch", payment_intent: "pi" } : structuredClone(intent) },
  });
  return { db: () => db, payment: () => db.payments[0], intent, refunds, disputes, sessions, creations, lockKeys,
    webhook, ledger, checkout, event, stripe, unit,
    timeout,
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

