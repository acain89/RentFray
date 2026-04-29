// app/api/stripe/webhook/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canMakePayments } from "@/lib/liveGating";
import { emitEvent } from "@/lib/realtime";
import { assertValidTransition } from "@/lib/paymentStatus";
import { getUnitLedgerSummary } from "@/lib/ledger";
import {
  getRentDateSummary,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function ensurePaymentFromIntent(
  intent: Stripe.PaymentIntent,
  stripeSessionId?: string | null
) {
  const metadata = intent.metadata || {};

  const propertyId = safeString(metadata.propertyId);
  const unitId = safeString(metadata.unitId);
  const tenantAssignmentId = safeString(metadata.tenantAssignmentId) || null;
  const billingCycle = safeString(metadata.billingCycle);
  const amountCents = parseCents(metadata.ledgerBalanceCents);
  const feeCents = parseCents(metadata.processingFeeCents);

  if (!propertyId || !unitId || !billingCycle) return null;

  return prisma.payment.upsert({
    where: { stripePaymentIntentId: intent.id },
    update: {
      stripeSessionId: stripeSessionId ?? undefined,
      billingCycle,
      amountCents,
      processingFeeCents: feeCents,
      paymentMethod: "ACH",
      failedAt: null,
      reversedAt: null,
    },
    create: {
      propertyId,
      unitId,
      tenantAssignmentId,
      stripePaymentIntentId: intent.id,
      stripeSessionId: stripeSessionId ?? null,
      billingCycle,
      amountCents,
      processingFeeCents: feeCents,
      status: "PENDING",
      paymentMethod: "ACH",
    },
  });
}

async function reverseLedgerEntries(intentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: intentId },
    include: { ledgerEntries: true },
  });

  if (!payment) return;

  const existingReversal = await prisma.ledgerEntry.findFirst({
    where: {
      referenceNumber: `${intentId}:reversal`,
      entryType: "ADJUSTMENT",
    },
    select: { id: true },
  });

  if (existingReversal) return;

  const entries = payment.ledgerEntries as { amountCents: number }[];

  const totalReversal = entries.reduce(
    (sum, entry) => sum + entry.amountCents,
    0
  );

  if (totalReversal === 0) return;

  await prisma.ledgerEntry.create({
    data: {
      propertyId: payment.propertyId,
      unitId: payment.unitId,
      tenantAssignmentId: payment.tenantAssignmentId,
      entryType: "ADJUSTMENT",
      amountCents: -totalReversal,
      effectiveDate: new Date(),
      paymentId: payment.id,
      referenceNumber: `${intentId}:reversal`,
      memo: "Payment reversal (ACH return / dispute)",
    },
  });

  await prisma.auditLog.create({
    data: {
      propertyId: payment.propertyId,
      actorType: "SYSTEM",
      action: "PAYMENT_REVERSED",
      targetType: "PAYMENT",
      targetId: intentId,
    },
  });

  emitEvent("payment:update", {
    propertyId: payment.propertyId,
    unitId: payment.unitId,
  });

  emitEvent("ledger:update", {
    propertyId: payment.propertyId,
    unitId: payment.unitId,
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
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
  } catch (error) {
    console.error("Stripe signature error:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (typeof session.payment_intent === "string") {
        const intent = await stripe.paymentIntents.retrieve(
          session.payment_intent
        );

        const payment = await ensurePaymentFromIntent(intent, session.id);

        if (payment) {
          emitEvent("payment:update", {
            propertyId: payment.propertyId,
            unitId: payment.unitId,
          });
        }
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "payment_intent.payment_failed") {
      const failedIntent = event.data.object as Stripe.PaymentIntent;
      await ensurePaymentFromIntent(failedIntent);
      await updatePaymentStatus(failedIntent.id, "FAILED");
      return NextResponse.json({ received: true });
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;

      if (typeof charge.payment_intent === "string") {
        await updatePaymentStatus(charge.payment_intent, "REVERSED");
        await reverseLedgerEntries(charge.payment_intent);
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "payment_intent.canceled") {
      const canceledIntent = event.data.object as Stripe.PaymentIntent;

      await ensurePaymentFromIntent(canceledIntent);
      await updatePaymentStatus(canceledIntent.id, "REVERSED");
      await reverseLedgerEntries(canceledIntent.id);

      return NextResponse.json({ received: true });
    }

    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;

      if (typeof dispute.payment_intent === "string") {
        await updatePaymentStatus(dispute.payment_intent, "REVERSED");
        await reverseLedgerEntries(dispute.payment_intent);
      }

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

      const requirementsDue = Boolean(
        account.requirements?.currently_due?.length ?? 0
      );

      await prisma.property.update({
        where: { id: property.id },
        data: {
          paymentStatus: {
            upsert: {
              create: {
                processorConnected: true,
                bankConnected: true,
                chargesEnabled: Boolean(account.charges_enabled),
                payoutsEnabled: Boolean(account.payouts_enabled),
                onboardingComplete: Boolean(account.details_submitted),
                requirementsDue,
                requirementsSummary:
                  account.requirements?.disabled_reason ?? null,
                lastSyncedAt: new Date(),
                readyForLive:
                  Boolean(account.charges_enabled) &&
                  Boolean(account.payouts_enabled),
              },
              update: {
                processorConnected: true,
                bankConnected: true,
                chargesEnabled: Boolean(account.charges_enabled),
                payoutsEnabled: Boolean(account.payouts_enabled),
                onboardingComplete: Boolean(account.details_submitted),
                requirementsDue,
                requirementsSummary:
                  account.requirements?.disabled_reason ?? null,
                lastSyncedAt: new Date(),
                readyForLive:
                  Boolean(account.charges_enabled) &&
                  Boolean(account.payouts_enabled),
              },
            },
          },
        },
      });

      emitEvent("payment:update", { propertyId: property.id });

      return NextResponse.json({ received: true });
    }

    if (event.type === "payment_intent.processing") {
      const processingIntent = event.data.object as Stripe.PaymentIntent;

      if (
        processingIntent.status !== "processing" ||
        processingIntent.payment_method_types?.[0] !== "us_bank_account" ||
        !processingIntent.payment_method ||
        typeof processingIntent.payment_method !== "string"
      ) {
        return NextResponse.json({ received: true });
      }

      const paymentMethod = await stripe.paymentMethods.retrieve(
        processingIntent.payment_method
      );

      if (!paymentMethod || paymentMethod.type !== "us_bank_account") {
        return NextResponse.json({ received: true });
      }

      const payment = await ensurePaymentFromIntent(processingIntent);

      if (payment) {
        await updatePaymentStatus(processingIntent.id, "PENDING");

        emitEvent("payment:update", {
          propertyId: payment.propertyId,
          unitId: payment.unitId,
        });
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (typeof session.payment_intent !== "string") {
        return NextResponse.json({ received: true });
      }

      const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
      const payment = await ensurePaymentFromIntent(intent, session.id);

      await updatePaymentStatus(intent.id, "PAID");

      if (payment) {
        emitEvent("payment:update", {
          propertyId: payment.propertyId,
          unitId: payment.unitId,
        });

        emitEvent("ledger:update", {
          propertyId: payment.propertyId,
          unitId: payment.unitId,
        });
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (typeof session.payment_intent === "string") {
        const intent = await stripe.paymentIntents.retrieve(
          session.payment_intent
        );

        await ensurePaymentFromIntent(intent, session.id);
        await updatePaymentStatus(session.payment_intent, "FAILED");
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "payment_intent.succeeded") {
  const succeededIntent = event.data.object as Stripe.PaymentIntent;

  if (succeededIntent.payment_method_types?.[0] !== "us_bank_account") {
    return NextResponse.json({ received: true });
  }

  const metadata = succeededIntent.metadata || {};

  const stripeAccountId = safeString(metadata.stripeAccountId);
  const propertyId = safeString(metadata.propertyId);
  const unitId = safeString(metadata.unitId);
  const tenantAssignmentId =
    safeString(metadata.tenantAssignmentId) || null;

  // ✅ USE SNAPSHOT FROM STRIPE (NOT LIVE LEDGER)
  const balanceCents = parseCents(metadata.ledgerBalanceCents);
  const feeCents = parseCents(metadata.processingFeeCents);
  const expectedCents =
    parseCents(metadata.totalAmountCents) || balanceCents + feeCents;

  if (!propertyId || !unitId || expectedCents <= 0) {
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
        succeededIntent.amount_received ??
        succeededIntent.amount ??
        balanceCents + feeCents;

      if (stripeCents <= 0) {
        return NextResponse.json({ received: true });
      }


      if (expectedCents !== stripeCents) {
        console.error("PAYMENT MISMATCH — BLOCKED", {
          expectedCents,
          stripeCents,
          intentId: succeededIntent.id,
        });

        await ensurePaymentFromIntent(succeededIntent);
        return NextResponse.json({ received: true });
      }

      const effectiveDate = new Date();

      const effective = resolveEffectiveBillingSettings({
        tier: null,
        propertySettings: property.settings,
      });

      const rentDates = getRentDateSummary({
        ...effective,
        now: effectiveDate,
      });

      const billingCycle =
        safeString(metadata.billingCycle) || rentDates.billingCycle;

      const payment = await ensurePaymentFromIntent(succeededIntent);

      if (!payment) {
        return NextResponse.json({ received: true });
      }

      let didWrite = false;

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existingLedgerPayment = await tx.ledgerEntry.findFirst({
          where: {
            referenceNumber: succeededIntent.id,
            entryType: "PAYMENT",
            unitId,
          },
          select: { id: true },
        });

        if (existingLedgerPayment) return;

        if (feeCents > 0) {
          const existingFee = await tx.ledgerEntry.findFirst({
            where: {
              referenceNumber: `${succeededIntent.id}:fee`,
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
                paymentId: payment.id,
                referenceNumber: `${succeededIntent.id}:fee`,
                memo: "Processing fee",
              },
            });
          }
        }

        await tx.ledgerEntry.create({
          data: {
            propertyId,
            unitId,
            tenantAssignmentId,
            entryType: "PAYMENT",
            paymentMethod: "ACH",
            amountCents: -expectedCents,
            effectiveDate,
            billingCycle,
            paymentId: payment.id,
            referenceNumber: succeededIntent.id,
            memo: "Stripe payment",
          },
        });

        didWrite = true;

        await tx.auditLog.create({
          data: {
            propertyId,
            actorType: "SYSTEM",
            action: "PAYMENT_RECORDED",
            targetType: "PAYMENT",
            targetId: succeededIntent.id,
            metadataJson: JSON.stringify({
              stripeCents,
              expectedCents,
              feeCents,
              balanceCents,
              billingCycle,
            }),
          },
        });
      });

      await updatePaymentStatus(succeededIntent.id, "PAID");

      emitEvent("payment:update", { propertyId, unitId });
      emitEvent("ledger:update", { propertyId, unitId });

      if (didWrite && property.status === "READY") {
        await prisma.property.update({
          where: { id: propertyId },
          data: { status: "LIVE" },
        });
      }

      return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}