// app/api/stripe/webhook/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reconcileStripeAccountStatus } from "@/lib/stripeAccountStatus";
import { emitEvent } from "@/lib/realtime";
import { assertValidTransition } from "@/lib/paymentStatus";
import { getBusinessDate, getBusinessDateInstant } from "@/lib/rentDates";

function businessDateInstant(): Date {
  const day = getBusinessDate();
  return getBusinessDateInstant(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeConnectWebhookSecret =
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

// Invalid mappings are acknowledged without writes; database/transport failures retry.
class InvalidFinancialEvent extends Error {}

type PaymentRecord = {
  id: string; propertyId: string; unitId: string; tenantAssignmentId: string | null;
  billingCycle: string | null; amountCents: number; processingFeeCents: number | null;
  stripePaymentIntentId: string | null; stripeSessionId: string | null;
  status: PaymentStatus; paidAt: Date | null;
};

function objectId(value: string | { id: string } | null | undefined): string {
  return typeof value === "string" ? value : value?.id ?? "";
}

function requireFinancial(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvalidFinancialEvent(message);
}

function validateMetadata(payment: PaymentRecord, metadata: Stripe.Metadata | null) {
  const m = metadata ?? {};
  requireFinancial(
    m.paymentId === payment.id && m.propertyId === payment.propertyId &&
    m.unitId === payment.unitId && m.tenantAssignmentId === payment.tenantAssignmentId &&
    m.billingCycle === payment.billingCycle &&
    /^\d+$/.test(m.ledgerBalanceCents ?? "") &&
    /^\d+$/.test(m.processingFeeCents ?? "") &&
    /^\d+$/.test(m.totalAmountCents ?? "") &&
    Number(m.ledgerBalanceCents) === payment.amountCents &&
    Number(m.processingFeeCents) === (payment.processingFeeCents ?? 0) &&
    Number(m.totalAmountCents) === payment.amountCents + (payment.processingFeeCents ?? 0),
    "Payment metadata/identity/quote mismatch"
  );
}

async function lockPayment(tx: Prisma.TransactionClient, payment: PaymentRecord) {
  // The tenancy lock also covers overlapping quotes across billing-cycle rollover.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${payment.propertyId}:${payment.unitId}:${payment.tenantAssignmentId ?? "none"}`}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${payment.propertyId}:${payment.unitId}:${payment.tenantAssignmentId ?? "none"}:${payment.billingCycle}`}))`;
}

async function transitionPayment(tx: Prisma.TransactionClient, payment: PaymentRecord, next: PaymentStatus) {
  if (payment.status === next) return;
  assertValidTransition(payment.status, next);
  await tx.payment.update({ where: { id: payment.id }, data: {
    status: next,
    ...(next === "PAID" ? { paidAt: payment.paidAt ?? new Date(), failedAt: null, reversedAt: null } : {}),
    ...(next === "FAILED" ? { failedAt: new Date() } : {}),
    ...(next === "REVERSED" ? { reversedAt: new Date() } : {}),
  } });
  payment.status = next;
}

async function returnedPrincipal(stripe: Stripe, payment: PaymentRecord, intent: Stripe.PaymentIntent) {
  const chargeId = objectId(intent.latest_charge);
  requireFinancial(chargeId, "Successful Intent has no charge");
  const charge = await stripe.charges.retrieve(chargeId);
  requireFinancial(objectId(charge.payment_intent) === intent.id && charge.currency === "usd" &&
    charge.amount === intent.amount && charge.payment_method_details?.type === "us_bank_account",
    "Charge identity/amount mismatch");
  let refunded = 0;
  // Pagination avoids silently missing previously returned money.
  for await (const refund of stripe.refunds.list({ charge: chargeId, limit: 100 })) {
    requireFinancial(objectId(refund.charge) === chargeId && refund.currency === "usd", "Refund identity mismatch");
    if (refund.status === "succeeded") refunded += refund.amount;
  }
  let withdrawn = 0;
  for await (const dispute of stripe.disputes.list({ charge: chargeId, limit: 100 })) {
    const current = await stripe.disputes.retrieve(dispute.id);
    requireFinancial(objectId(current.charge) === chargeId, "Dispute identity mismatch");
    const seen = new Set<string>();
    for (const movement of current.balance_transactions) {
      requireFinancial(movement.currency === "usd" && Number.isSafeInteger(movement.amount), "Invalid dispute movement");
      if (seen.has(movement.id)) continue;
      seen.add(movement.id);
      // Gross amount excludes the dispute fees contained in net; fees are not rent debt.
      withdrawn -= movement.amount;
    }
  }
  const grossReturned = refunded + withdrawn;
  const total = payment.amountCents + (payment.processingFeeCents ?? 0);
  requireFinancial(Number.isSafeInteger(grossReturned) && grossReturned >= 0 && grossReturned <= total,
    "Returned funds overlap/exceed the quote; separate reconciliation required");
  if (grossReturned === 0) return 0;
  if (grossReturned === total) return payment.amountCents;
  // Bundled-fee partial returns do not identify principal vs fee allocation. Fail safely.
  requireFinancial(!(payment.processingFeeCents ?? 0), "Partial return fee allocation is not conclusive");
  return grossReturned;
}

async function reconcileReturnedFunds(tx: Prisma.TransactionClient, payment: PaymentRecord, intentId: string, principal: number) {
  const full = principal === payment.amountCents;
  const feeVoidReason = "Stripe returned payment processing fee";
  const adjustmentKey = `stripe:${intentId}:returned-principal`;
  const adjustment = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: adjustmentKey } });
  if (principal > 0 && !full) {
    // Keep PAID and its remaining credit for a partial return; replace cumulative loss, not add it.
    const data = { amountCents: principal, voidedAt: null, voidReason: null };
    await tx.ledgerEntry.upsert({ where: { idempotencyKey: adjustmentKey }, update: data, create: {
      ...data, idempotencyKey: adjustmentKey, propertyId: payment.propertyId, unitId: payment.unitId,
      tenantAssignmentId: payment.tenantAssignmentId, paymentId: payment.id,
      billingCycle: payment.billingCycle, entryType: "ADJUSTMENT", effectiveDate: businessDateInstant(),
      referenceNumber: `${intentId}:returned-principal`, memo: "Actual returned tenant principal",
    } });
  } else if (adjustment && !adjustment.voidedAt) {
    await tx.ledgerEntry.update({ where: { id: adjustment.id }, data: {
      voidedAt: new Date(), voidReason: full ? "Full return accounted by REVERSED payment" : "Returned funds reinstated",
    } });
  }
  if (full) {
    // Removing PAYMENT credit is the sole full-principal restoration. Neutralize its fee charge.
    await tx.ledgerEntry.updateMany({ where: {
      paymentId: payment.id, referenceNumber: `${intentId}:fee`, chargeType: "PROCESSING_FEE", voidedAt: null,
    }, data: { voidedAt: new Date(), voidReason: feeVoidReason } });
  } else {
    await tx.ledgerEntry.updateMany({ where: {
      paymentId: payment.id, referenceNumber: `${intentId}:fee`, chargeType: "PROCESSING_FEE", voidReason: feeVoidReason,
    }, data: { voidedAt: null, voidReason: null } });
  }
  await transitionPayment(tx, payment, full ? "REVERSED" : "PAID");
}

async function ensureCollection(tx: Prisma.TransactionClient, payment: PaymentRecord, intent: Stripe.PaymentIntent) {
  const common = {
    propertyId: payment.propertyId, unitId: payment.unitId,
    tenantAssignmentId: payment.tenantAssignmentId, billingCycle: payment.billingCycle,
    paymentId: payment.id, effectiveDate: businessDateInstant(),
  };
  const expected = payment.amountCents + (payment.processingFeeCents ?? 0);
  const existing = await tx.ledgerEntry.findFirst({ where: {
    paymentId: payment.id, entryType: "PAYMENT", referenceNumber: intent.id,
  } });
  if (existing) {
    requireFinancial(existing.propertyId === payment.propertyId && existing.unitId === payment.unitId &&
      existing.tenantAssignmentId === payment.tenantAssignmentId && existing.amountCents === -expected &&
      !existing.voidedAt, "Existing collection ledger identity mismatch");
  } else {
    await tx.ledgerEntry.create({ data: {
      ...common, entryType: "PAYMENT", paymentMethod: "ACH", amountCents: -expected,
      referenceNumber: intent.id, idempotencyKey: `stripe:${intent.id}:payment`, memo: "Stripe payment",
    } });
  }
  const fee = payment.processingFeeCents ?? 0;
  if (fee > 0) {
    const existingFee = await tx.ledgerEntry.findFirst({ where: {
      paymentId: payment.id, entryType: "CHARGE", referenceNumber: `${intent.id}:fee`,
    } });
    if (existingFee) {
      requireFinancial(existingFee.amountCents === fee && existingFee.chargeType === "PROCESSING_FEE" &&
        existingFee.propertyId === payment.propertyId && existingFee.unitId === payment.unitId &&
        existingFee.tenantAssignmentId === payment.tenantAssignmentId, "Existing processing fee identity mismatch");
    } else {
      await tx.ledgerEntry.create({ data: {
        ...common, entryType: "CHARGE", chargeType: "PROCESSING_FEE", amountCents: fee,
        referenceNumber: `${intent.id}:fee`, idempotencyKey: `stripe:${intent.id}:fee`, memo: "Processing fee",
      } });
    }
  }
  return !existing;
}

async function applyPaymentEvent(stripe: Stripe, event: Stripe.Event) {
  const object = event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session | Stripe.Charge | Stripe.Dispute;
  const isIntent = event.type.startsWith("payment_intent.");
  const isCheckout = event.type.startsWith("checkout.session.");
  const suppliedIntentId = isIntent ? object.id : objectId((object as Stripe.Charge).payment_intent);
  const metadata = "metadata" in object ? object.metadata : null;
  const paymentId = safeString(metadata?.paymentId);
  const initial: PaymentRecord | null = await prisma.payment.findFirst({ where: paymentId
    ? { id: paymentId } : { stripePaymentIntentId: suppliedIntentId || "__unmapped__" } });
  requireFinancial(initial, "Payment event cannot be mapped to an existing reservation");
  if (isIntent || isCheckout) validateMetadata(initial, metadata);
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await lockPayment(tx, initial);
    const payment = await tx.payment.findUnique({ where: { id: initial.id } }) as PaymentRecord | null;
    requireFinancial(payment, "Payment reservation disappeared");
    if (isIntent || isCheckout) validateMetadata(payment, metadata);
    const sessionId = isCheckout ? object.id : null;
    if (sessionId) requireFinancial(!payment.stripeSessionId || payment.stripeSessionId === sessionId, "Checkout identity mismatch");
    const intentId = suppliedIntentId || payment.stripePaymentIntentId;
    requireFinancial(intentId && (!payment.stripePaymentIntentId || payment.stripePaymentIntentId === intentId), "Intent identity mismatch");
    if ((event.type === "payment_intent.processing" || event.type === "checkout.session.completed" ||
      event.type === "payment_intent.payment_failed" || event.type === "checkout.session.async_payment_failed") &&
      (payment.status === "PAID" || payment.status === "REVERSED")) return;
    const intent = await stripe.paymentIntents.retrieve(intentId);
    validateMetadata(payment, intent.metadata);
    requireFinancial(intent.currency === "usd" && intent.amount === payment.amountCents + (payment.processingFeeCents ?? 0) &&
      intent.payment_method_types.includes("us_bank_account") && payment.amountCents > 0,
      "Intent amount/currency/payment method mismatch");
    const account = safeString(intent.metadata.stripeAccountId);
    requireFinancial(account && objectId(intent.on_behalf_of) === account && objectId(intent.transfer_data?.destination) === account,
      "Stripe destination identity mismatch");
    const unit = await tx.unit.findFirst({ where: { id: payment.unitId, propertyId: payment.propertyId }, select: { id: true } });
    const assignment = payment.tenantAssignmentId ? await tx.tenantAssignment.findFirst({ where: {
      id: payment.tenantAssignmentId, propertyId: payment.propertyId, unitId: payment.unitId,
    }, select: { id: true } }) : null;
    requireFinancial(unit && assignment, "Historical tenancy identity cannot be validated");
    if (!isIntent && !isCheckout) {
      const chargeId = event.type.startsWith("charge.dispute.") ? objectId((object as Stripe.Dispute).charge) : object.id;
      requireFinancial(chargeId === objectId(intent.latest_charge), "Event charge identity mismatch");
    }
    const legacy = await tx.ledgerEntry.findFirst({ where: {
      paymentId: payment.id, referenceNumber: `${intent.id}:reversal`, voidedAt: null,
    }, select: { id: true } });
    requireFinancial(!legacy, "Legacy reversal requires separate historical reconciliation");
    const collected = intent.status === "succeeded";
    if (collected) requireFinancial(intent.amount_received === intent.amount, "Collected amount mismatch");
    const principal = collected ? await returnedPrincipal(stripe, payment, intent) : null;
    await tx.payment.update({ where: { id: payment.id }, data: {
      stripePaymentIntentId: intent.id, ...(sessionId ? { stripeSessionId: sessionId } : {}),
    } });
    if (collected) {
      const wroteCollection = await ensureCollection(tx, payment, intent);
      if (payment.status !== "REVERSED") await transitionPayment(tx, payment, "PAID");
      await reconcileReturnedFunds(tx, payment, intent.id, principal!);
      if (wroteCollection) {
        await tx.property.updateMany({ where: { id: payment.propertyId, status: "READY" }, data: { status: "LIVE" } });
      }
      await tx.auditLog.create({ data: {
        propertyId: payment.propertyId, actorType: "SYSTEM", action: "PAYMENT_RECONCILED", targetType: "PAYMENT", targetId: payment.id,
        metadataJson: JSON.stringify({ eventId: event.id, intentId: intent.id, returnedPrincipalCents: principal, status: payment.status }),
      } });
    } else if (payment.status !== "PAID" && payment.status !== "REVERSED") {
      if (intent.status === "processing") await transitionPayment(tx, payment, "PENDING");
      else if (intent.status === "canceled" || intent.last_payment_error) await transitionPayment(tx, payment, "FAILED");
    }
  }, { timeout: 60_000 });
  emitEvent("payment:update", { propertyId: initial.propertyId, unitId: initial.unitId });
  emitEvent("ledger:update", { propertyId: initial.propertyId, unitId: initial.unitId });
  emitEvent("tenant:update", { propertyId: initial.propertyId, unitId: initial.unitId });
}

export async function POST(req: Request) {
  if (!stripeSecretKey || !stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });

  const body = await req.text();
const sig = (await headers()).get("stripe-signature");

if (!sig) {
  return NextResponse.json(
    { error: "Missing signature" },
    { status: 400 }
  );
}

const webhookSecrets = [
  stripeWebhookSecret,
  stripeConnectWebhookSecret,
].filter((secret): secret is string => Boolean(secret?.trim()));

if (webhookSecrets.length === 0) {
  console.error("No Stripe webhook signing secrets are configured.");

  return NextResponse.json(
    { error: "Webhook configuration error" },
    { status: 500 }
  );
}

let event: Stripe.Event | null = null;
let signatureError: unknown = null;

for (const secret of webhookSecrets) {
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
    break;
  } catch (error) {
    signatureError = error;
  }
}

if (!event) {
  console.error("Stripe signature error:", signatureError);

  return NextResponse.json(
    { error: "Invalid signature" },
    { status: 400 }
  );
}

  try {
    const paymentEvents = new Set([
      "checkout.session.completed", "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed", "payment_intent.processing",
      "payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled",
      "charge.refunded", "charge.dispute.created", "charge.dispute.funds_withdrawn",
      "charge.dispute.funds_reinstated",
    ]);
    if (paymentEvents.has(event.type)) {
      await applyPaymentEvent(stripe, event);
      return NextResponse.json({ received: true });
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;

      if (!account.id) {
        return NextResponse.json({ received: true });
      }

      const property = await prisma.property.findFirst({
        where: { stripeAccountId: account.id },
        include: { paymentStatus: true },
      });

      if (!property) {
        return NextResponse.json({ received: true });
      }

      await reconcileStripeAccountStatus(property.id, { stripe, expectedAccountId: account.id });

      emitEvent("payment:update", { propertyId: property.id });

      return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    if (error instanceof InvalidFinancialEvent) {
      return NextResponse.json({ received: true, reconciled: false });
    }
    return NextResponse.json({ error: "Webhook reconciliation failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}