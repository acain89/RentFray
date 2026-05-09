import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession, refreshSessionCookie } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { canMakePayments } from "@/lib/liveGating";
import { checkRateLimit } from "@/lib/rateLimit";
import { getProcessingFeeCents } from "@/lib/billingConfig";
import {
  getRentDateSummary,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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


export async function POST(req: Request) {

  try {
        const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimit = checkRateLimit(`create-session:${ip}`, 10, 60_000);

    if (!rateLimit.ok) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Too many payment attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

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

await refreshSessionCookie(session);

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

    const assignment = unit.tenantAssignments[0] ?? null;

const ledger = await getUnitLedgerSummary(
  unit.id,
  assignment?.id ?? undefined
);
    const balanceCents = Math.max(0, toSafeInteger(ledger.balanceCents));

    if (balanceCents <= 0) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "No balance due." },
        { status: 400 }
      );
    }

    const processingFeeCents = getProcessingFeeCents(balanceCents);
    const totalCents = balanceCents + processingFeeCents;
    const now = new Date();

const effectiveBillingSettings = resolveEffectiveBillingSettings({
  tier: unit.tier ?? null,
  propertySettings: property.settings ?? null,
});

const rentDates = getRentDateSummary({
  ...effectiveBillingSettings,
  now,
  billingCycleStartDate: property.billingCycleStartDate,
});

const billingCycle = rentDates.billingCycle;

    if (totalCents <= 0) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    const tenantAssignmentId = assignment?.id ?? null;

         const createdPayment = await prisma.$transaction(
  async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`${property.id}:${unit.id}:${tenantAssignmentId ?? "none"}:${billingCycle}`}))
    `;

    const existingPayment = await tx.payment.findFirst({
      where: {
        propertyId: property.id,
        unitId: unit.id,
        tenantAssignmentId: tenantAssignmentId ?? undefined,
        billingCycle,
        status: {
          in: ["PENDING", "PAID"],
        },
      },
      select: { id: true },
    });

    if (existingPayment) {
      return null;
    }

    return tx.payment.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        tenantAssignmentId: tenantAssignmentId ?? undefined,
        billingCycle,
        amountCents: balanceCents,
        processingFeeCents,
        status: "PENDING",
      },
    });
  }
);

    if (!createdPayment) {
      return NextResponse.json(
        { ok: false, error: "Payment already in progress." },
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

    
   const paymentMetadata = {
  paymentId: createdPayment.id,
  propertyId: property.id,
  unitId: unit.id,
  stripeAccountId: property.stripeAccountId,
  tenantAssignmentId: tenantAssignmentId ?? "",
  ledgerBalanceCents: String(balanceCents),
  processingFeeCents: String(processingFeeCents),
  totalAmountCents: String(totalCents),
  billingCycle,
  paymentStartedAt: new Date().toISOString(),
};

const checkoutSession = await stripe.checkout.sessions.create({
  payment_intent_data: {
    application_fee_amount: processingFeeCents,
    on_behalf_of: property.stripeAccountId,
    transfer_data: {
      destination: property.stripeAccountId,
    },
    metadata: paymentMetadata,
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
          name: `${property.name} — Unit ${unit.unitNumber}`,
          description: `Rent payment for ${property.name}`,
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
                name: `${property.name} processing fee`,
                description: `ACH processing fee for ${property.name}`,
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
  metadata: paymentMetadata,
});

   await prisma.payment.update({
  where: {
    id: createdPayment.id,
  },
  data: {
    stripeSessionId: checkoutSession.id,
    stripePaymentIntentId:
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : null,
  },
});

    if (!checkoutSession.url) {
  return NextResponse.json<ApiError>(
    { ok: false, error: "No checkout URL returned." },
    { status: 500 }
  );
}

    return NextResponse.json<ApiSuccess<{ url: string }>>({
      ok: true,
      data: { url: checkoutSession.url },
    });
  } catch (error: unknown) {
   

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