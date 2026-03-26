import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { canMakePayments } from "@/lib/liveGating";

export const runtime = "nodejs";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

function toMoney(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function toCents(value: unknown): number {
  return Math.round(toMoney(value) * 100);
}

export async function POST(req: Request) {
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
        tier: true,
        property: {
          include: {
            settings: true,
            paymentStatus: true,
            units: true,
          },
        },
        tenantAssignments: {
          where: { isCurrent: true },
          orderBy: [{ moveInDate: "desc" }],
          take: 1,
        },
      },
    });

    if (!unit || !unit.tier) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Unit or tier not found." },
        { status: 404 }
      );
    }

    const property = unit.property;

    if (
      !canMakePayments({
        status: property.status,
        settings: property.settings,
        units: property.units,
        paymentConnectionStatus: property.paymentStatus,
      })
    ) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Payments not available." },
        { status: 400 }
      );
    }

    const ledger = await getUnitLedgerSummary(unit.id);

    const balanceDue = Math.max(0, toMoney(ledger.balance));

    if (balanceDue <= 0) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "No balance due." },
        { status: 400 }
      );
    }

    const processingFee = toMoney(unit.tier.processingFee ?? 0);
    const total = toMoney(balanceDue + processingFee);

    const baseCents = toCents(balanceDue);
    const feeCents = toCents(processingFee);
    const totalCents = toCents(total);

    if (totalCents <= 0) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    const assignment = unit.tenantAssignments[0] ?? null;
    const tenantAssignmentId = assignment?.id ?? "";

    const tenantName =
      assignment && (assignment.firstName || assignment.lastName)
        ? `${assignment.firstName ?? ""} ${assignment.lastName ?? ""}`.trim()
        : `Unit ${unit.unitNumber}`;

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:10000";

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["us_bank_account"],
      customer_creation: "if_required",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `RentFray payment — Unit ${unit.unitNumber}`,
              description: `${property.name} balance payment for ${tenantName}`,
            },
            unit_amount: baseCents,
          },
          quantity: 1,
        },
        ...(feeCents > 0
          ? [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: "Processing fee",
                    description: `${property.name} ACH processing fee`,
                  },
                  unit_amount: feeCents,
                },
                quantity: 1,
              },
            ]
          : []),
      ],

      success_url: `${origin}/tenant/pay?status=success`,
      cancel_url: `${origin}/tenant/pay?status=cancelled`,

      metadata: {
        propertyId: property.id,
        unitId: unit.id,
        tenantAssignmentId,
        ledgerBalanceCents: String(baseCents),
        processingFeeCents: String(feeCents),
        totalAmountCents: String(totalCents),
      },
    });

    if (!checkoutSession.url) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "No checkout URL returned." },
        { status: 500 }
      );
    }

    await prisma.payment.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        tenantAssignmentId: tenantAssignmentId || null,
        stripePaymentIntentId: `pending:${checkoutSession.id}`,
        stripeSessionId: checkoutSession.id,
        amountCents: baseCents,
        processingFeeCents: feeCents,
        status: "PENDING",
        paymentMethod: "ACH",
      },
    });

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