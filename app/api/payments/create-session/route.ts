import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { canMakePayments } from "@/lib/liveGating";
import { getProcessingFeeCents } from "@/lib/billingConfig";

export const runtime = "nodejs";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

function toSafeInteger(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function getBillingCycle(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

export async function POST(req: Request) {
  let paymentLockId: string | null = null;

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Stripe not configured." },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const session = await getSession();

    if (
      !session ||
      session.role !== "TENANT" ||
      !session.unitId ||
      !session.propertyId
    ) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      include: {
        property: {
          include: {
            settings: true,
            paymentStatus: true,
            units: true,
          },
        },
        tenantAssignments: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!unit) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Unit not found." },
        { status: 404 }
      );
    }

    const property = unit.property;

    if (property?.stripeAccountId) {
      const stripeAccount = await stripe.accounts.retrieve(
        property.stripeAccountId
      );

      const updatedStatus = {
        processorConnected: true,
        bankConnected: true,
        chargesEnabled: Boolean(stripeAccount.charges_enabled),
        payoutsEnabled: Boolean(stripeAccount.payouts_enabled),
        onboardingComplete: Boolean(stripeAccount.details_submitted),
        requirementsDue: Boolean(
          stripeAccount.requirements?.currently_due?.length
        ),
        requirementsSummary:
          stripeAccount.requirements?.disabled_reason ?? null,
        lastSyncedAt: new Date(),
        readyForLive:
          Boolean(stripeAccount.charges_enabled) &&
          Boolean(stripeAccount.payouts_enabled),
      };

      await prisma.property.update({
        where: { id: property.id },
        data: {
          paymentStatus: {
            upsert: {
              create: updatedStatus,
              update: updatedStatus,
            },
          },
        },
      });

      property.paymentStatus = {
        ...property.paymentStatus,
        ...updatedStatus,
      };
    }

    if (
      !canMakePayments({
        status: property.status,
        settings: property.settings,
        units: property.units,
        paymentStatus: property.paymentStatus,
        isActive: property.isActive,
      })
    ) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Payments not available." },
        { status: 400 }
      );
    }

    const ledger = await getUnitLedgerSummary(unit.id);
    const balanceCents = Math.max(0, toSafeInteger(ledger.balanceCents));

    if (balanceCents <= 0) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "No balance due." },
        { status: 400 }
      );
    }

    const processingFeeCents = getProcessingFeeCents(balanceCents);
    const totalCents = balanceCents + processingFeeCents;
    const billingCycle = getBillingCycle(new Date());

    if (totalCents <= 0) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    const assignment = unit.tenantAssignments[0] ?? null;
    const tenantAssignmentId = assignment?.id ?? null;

    const existingPayment = await prisma.payment.findFirst({
      where: {
        unitId: unit.id,
        billingCycle,
        status: {
          in: ["PENDING", "PAID"],
        },
      },
      select: {
        id: true,
      },
    });

    if (existingPayment) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Payment already in progress or completed." },
        { status: 400 }
      );
    }

    if (!property.stripeAccountId) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Bank not connected" },
        { status: 400 }
      );
    }

    const tenantName =
      assignment && (assignment.firstName || assignment.lastName)
        ? `${assignment.firstName ?? ""} ${assignment.lastName ?? ""}`.trim()
        : `Unit ${unit.unitNumber}`;

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:10000";

    const paymentLock = await prisma.payment.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        tenantAssignmentId,
        stripeSessionId: null,
        stripePaymentIntentId: null,
        billingCycle,
        amountCents: balanceCents,
        processingFeeCents,
        status: "PENDING",
        paymentMethod: "ACH",
      },
      select: {
        id: true,
      },
    });

    paymentLockId = paymentLock.id;

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_intent_data: {
        application_fee_amount: processingFeeCents,
        transfer_data: {
          destination: property.stripeAccountId,
        },
      },
      mode: "payment",
      payment_method_types: ["us_bank_account"],
      payment_method_options: {
        us_bank_account: {
          verification_method: "instant",
          financial_connections: {
            permissions: ["payment_method"],
          },
        },
      },
      customer_creation: "if_required",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `RentFray payment — Unit ${unit.unitNumber}`,
              description: `${property.name} balance payment for ${tenantName}`,
            },
            unit_amount: balanceCents,
          },
          quantity: 1,
        },
        ...(processingFeeCents > 0
          ? [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: "Processing fee",
                    description: `${property.name} ACH processing fee`,
                  },
                  unit_amount: processingFeeCents,
                },
                quantity: 1,
              },
            ]
          : []),
      ],
      success_url: `${origin}/tenant/pay?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/tenant/pay?checkout=cancelled`,
      metadata: {
        propertyId: property.id,
        unitId: unit.id,
        stripeAccountId: property.stripeAccountId,
        tenantAssignmentId: tenantAssignmentId ?? "",
        ledgerBalanceCents: String(balanceCents),
        processingFeeCents: String(processingFeeCents),
        totalAmountCents: String(totalCents),
        billingCycle,
        paymentStartedAt: new Date().toISOString(),
      },
    });

    if (!checkoutSession.url) {
      await prisma.payment.delete({
        where: { id: paymentLock.id },
      });

      return NextResponse.json<ApiError>(
        { ok: false, error: "No checkout URL returned." },
        { status: 500 }
      );
    }

    await prisma.payment.update({
      where: { id: paymentLock.id },
      data: {
        stripeSessionId: checkoutSession.id,
      },
    });

    return NextResponse.json<ApiSuccess<{ url: string }>>({
      ok: true,
      data: { url: checkoutSession.url },
    });
  } catch (error: unknown) {
    if (paymentLockId) {
      try {
        await prisma.payment.delete({
          where: { id: paymentLockId },
        });
      } catch {
        // swallow cleanup error
      }
    }

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json<ApiError>(
        { ok: false, error: error.message || "Stripe error." },
        { status: 400 }
      );
    }

    console.error("create-session error:", error);

    return NextResponse.json<ApiError>(
      { ok: false, error: "Failed to create payment session." },
      { status: 500 }
    );
  }
}