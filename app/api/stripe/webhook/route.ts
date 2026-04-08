import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canMakePayments } from "@/lib/liveGating";
import { emitEvent } from "@/lib/realtime";
import { assertValidTransition } from "@/lib/paymentStatus";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

function parseCents(value: string | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function getBillingCycle(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

async function updatePaymentStatus(
  intentId: string,
  nextStatus: PaymentStatus
): Promise<void> {
  if (!intentId) return;

  const existing = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: intentId },
    select: { status: true },
  });

  if (!existing) return;

  const currentStatus = existing.status as PaymentStatus;

  if (currentStatus === nextStatus) return;

  assertValidTransition(currentStatus, nextStatus);

  await prisma.payment.update({
    where: { stripePaymentIntentId: intentId },
    data: {
      status: nextStatus,
      ...(nextStatus === "PAID" && { paidAt: new Date() }),
      ...(nextStatus === "FAILED" && { failedAt: new Date() }),
      ...(nextStatus === "REVERSED" && { reversedAt: new Date() }),
    },
  });
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

  let event: Stripe.Event;

  try {
    const body = await req.text();
    const sig = (await headers()).get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
  } catch {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    // Attach paymentIntent to existing payment record
    if (event.type === "checkout.session.completed") {

     // ACH NOTE:
// checkout.session.completed does NOT mean funds cleared.
// We ONLY mark PAID on payment_intent.succeeded.
// This block is ONLY for linking session → paymentIntent.

      const session = event.data.object as Stripe.Checkout.Session;

      if (typeof session.payment_intent === "string") {
        await prisma.payment.updateMany({
          where: { stripeSessionId: session.id },
          data: { stripePaymentIntentId: session.payment_intent },
        });
      }
    }
  
     const intent = event.data.object as Stripe.PaymentIntent;


    if (event.type === "payment_intent.payment_failed") {
      await updatePaymentStatus(intent.id, "FAILED");
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;

      if (typeof charge.payment_intent === "string") {
        await updatePaymentStatus(charge.payment_intent, "REVERSED");
      }
    }

if (event.type === "payment_intent.succeeded") {
  const intent = event.data.object as Stripe.PaymentIntent;

  if (intent.payment_method_types?.[0] !== "us_bank_account") {
    return NextResponse.json({ received: true });
  }
      const metadata = intent.metadata || {};

      const stripeAccountId = safeString(metadata.stripeAccountId);

      const propertyId = safeString(metadata.propertyId);
      const unitId = safeString(metadata.unitId);
      const tenantAssignmentId =
        safeString(metadata.tenantAssignmentId) || null;

      const balanceCents = parseCents(metadata.ledgerBalanceCents);
      const feeCents = parseCents(metadata.processingFeeCents);

      if (!propertyId || !unitId) {
        return NextResponse.json({ received: true });
      }

      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          settings: true,
          units: true,
          paymentStatus: true,
        },
      });

      if (!property || !property.isActive || !canMakePayments(property)) {
        return NextResponse.json({ received: true });
      }

      if (stripeAccountId && property.stripeAccountId !== stripeAccountId) {
  console.error("STRIPE ACCOUNT MISMATCH", {
    metadataAccount: stripeAccountId,
    propertyAccount: property.stripeAccountId,
  });

  return NextResponse.json({ received: true });
}

      const stripeCents =
        intent.amount_received ?? intent.amount ?? balanceCents + feeCents;

      if (stripeCents <= 0) {
        return NextResponse.json({ received: true });
      }

      const expectedCents = balanceCents + feeCents;

      // 🔒 STRICT: NO PARTIAL PAYMENTS
      if (expectedCents !== stripeCents) {
        console.error("PAYMENT MISMATCH — BLOCKED", {
          expectedCents,
          stripeCents,
          intentId: intent.id,
        });

        return NextResponse.json({ received: true });
      }

      // 🔒 REQUIRE EXISTING PAYMENT RECORD
      const existingPayment = await prisma.payment.findUnique({
        where: { stripePaymentIntentId: intent.id },
      });

      if (!existingPayment) {
        return NextResponse.json({ received: true });
      }

      const effectiveDate = new Date();
      const billingCycle = getBillingCycle(effectiveDate);

      let didWrite = false;

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 🔒 IDEMPOTENCY CHECK
        const existing = await tx.ledgerEntry.findFirst({
          where: {
            referenceNumber: intent.id,
            entryType: "PAYMENT",
            unitId,
          },
          select: { id: true },
        });

        if (existing) return;

        // 🔒 PROCESSING FEE ENTRY
        if (feeCents > 0) {
          const existingFee = await tx.ledgerEntry.findFirst({
            where: {
              referenceNumber: `${intent.id}:fee`,
              entryType: "CHARGE",
              unitId,
            },
            select: { id: true },
          });

          if (!existingFee) {
            await tx.ledgerEntry.create({
              data: {
                propertyId,
                unitId,
                tenantAssignmentId,
                entryType: "CHARGE",
                chargeType: "PROCESSING_FEE",
                amountCents: feeCents,
                effectiveDate,
                billingCycle,
                paymentId: existingPayment.id,
                referenceNumber: `${intent.id}:fee`,
                memo: "Processing fee",
              },
            });
          }
        }

        // 🔒 PAYMENT ENTRY
        await tx.ledgerEntry.create({
          data: {
            propertyId,
            unitId,
            tenantAssignmentId,
            entryType: "PAYMENT",
            paymentMethod: "ACH",
            amountCents: -balanceCents,
            effectiveDate,
            billingCycle,
            paymentId: existingPayment.id,
            referenceNumber: intent.id,
            memo: "Stripe payment",
          },
        });

        didWrite = true;

        // 🔒 AUDIT LOG
        await tx.auditLog.create({
          data: {
            propertyId,
            actorType: "SYSTEM",
            action: "PAYMENT_RECORDED",
            targetType: "PAYMENT",
            targetId: intent.id,
            metadataJson: JSON.stringify({
              stripeCents,
              expectedCents,
              feeCents,
              billingCycle,
            }),
          },
        });
      });

      await updatePaymentStatus(intent.id, "PAID");

      if (didWrite) {
        emitEvent("payment:update", { propertyId, unitId });
        emitEvent("ledger:update", { propertyId, unitId });
      }
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}