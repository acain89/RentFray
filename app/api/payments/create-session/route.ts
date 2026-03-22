// [path: app/api/payments/create-session/route.ts]

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { canMakePayments } from "@/lib/liveGating";

export const runtime = "nodejs";

type RecurringFeeItemRow = {
  id: string;
  label: string;
  amount: number;
};

type RecurringCharge = {
  id: string;
  label: string;
  amount: number;
};

function moneyCents(value: number) {
  return Math.round(Number(value || 0) * 100);
}

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      console.error("Create Stripe session error: missing STRIPE_SECRET_KEY");
      return NextResponse.json(
        { error: "Stripe secret key is not configured." },
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      include: {
        tier: true,
        recurringFeeItems: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            label: true,
            amount: true,
          },
        },
        property: {
          include: {
            settings: true,
            paymentStatus: true,
            units: true,
          },
        },
        tenantAssignments: {
          where: {
            isCurrent: true,
          },
          orderBy: {
            moveInDate: "desc",
          },
          take: 1,
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found." }, { status: 404 });
    }

    if (!unit.tier) {
      return NextResponse.json(
        { error: "Unit tier not found." },
        { status: 400 }
      );
    }

    const property = unit.property;

    const propertyForGating = {
      status: property.status,
      settings: property.settings,
      units: property.units,
      paymentStatus: property.paymentStatus,
    };

    if (!canMakePayments(propertyForGating)) {
      return NextResponse.json(
        {
          error: "Payments are not available for this property yet.",
          debug: {
            propertyStatus: property.status,
            paymentStatus: property.paymentStatus,
          },
        },
        { status: 400 }
      );
    }

    const ledger = await getUnitLedgerSummary(unit.id);
    const balanceDue = Math.max(0, roundMoney(Number(ledger.balance || 0)));

    if (balanceDue <= 0) {
      return NextResponse.json({ error: "No balance due." }, { status: 400 });
    }

    const baseRent = roundMoney(
      Number(unit.tier.baseRent || unit.baseRent || 0)
    );

    const recurringFeeItems: RecurringFeeItemRow[] = unit.recurringFeeItems.map(
      (fee: RecurringFeeItemRow) => ({
        id: fee.id,
        label: fee.label,
        amount: Number(fee.amount || 0),
      })
    );

    const recurringCharges: RecurringCharge[] = recurringFeeItems.map(
      (fee: RecurringFeeItemRow) => ({
        id: fee.id,
        label: fee.label,
        amount: roundMoney(Number(fee.amount || 0)),
      })
    );

    const recurringChargeTotal = roundMoney(
      recurringCharges.reduce(
        (sum: number, fee: RecurringCharge) => sum + fee.amount,
        0
      )
    );

    const monthlySubtotal = roundMoney(baseRent + recurringChargeTotal);
    const processingFee = roundMoney(Number(unit.tier.processingFee || 0));
    const total = roundMoney(balanceDue + processingFee);

    const baseAmountCents = moneyCents(balanceDue);
    const processingFeeCents = moneyCents(processingFee);
    const totalAmountCents = moneyCents(total);

    if (totalAmountCents <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    const activeAssignment = unit.tenantAssignments[0] || null;
    const tenantAssignmentId = activeAssignment?.id || "";
    const tenantName = activeAssignment
      ? [activeAssignment.firstName, activeAssignment.lastName]
          .filter(Boolean)
          .join(" ")
      : `Unit ${unit.unitNumber}`;

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:10000";

    console.log("Create Stripe session payload", {
      propertyId: property.id,
      unitId: unit.id,
      tierId: unit.tier.id,
      tenantAssignmentId,
      propertyStatus: property.status,
      paymentStatus: property.paymentStatus,
      baseRent,
      recurringChargeTotal,
      monthlySubtotal,
      balanceDue,
      processingFee,
      total,
      origin,
    });

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
            unit_amount: baseAmountCents,
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
                quantity: 1 as const,
              },
            ]
          : []),
      ],
      success_url: `${origin}/tenant/pay?status=success`,
      cancel_url: `${origin}/tenant/pay?status=cancelled`,
      metadata: {
        propertyId: property.id,
        unitId: unit.id,
        tierId: unit.tier.id,
        tenantAssignmentId,
        baseRent: baseRent.toFixed(2),
        recurringChargeTotal: recurringChargeTotal.toFixed(2),
        monthlySubtotal: monthlySubtotal.toFixed(2),
        balanceDue: balanceDue.toFixed(2),
        processingFee: processingFee.toFixed(2),
        totalAmount: total.toFixed(2),
        baseAmountCents: String(baseAmountCents),
        processingFeeCents: String(processingFeeCents),
        totalAmountCents: String(totalAmountCents),
      },
    });

    if (!checkoutSession.url) {
      console.error("Create Stripe session error: no checkout url returned");
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      pricing: {
        baseRent,
        recurringChargeTotal,
        monthlySubtotal,
        balanceDue,
        processingFee,
        total,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("Create Stripe session StripeError:", {
        type: error.type,
        code: error.code,
        message: error.message,
        param: error.param,
      });

      return NextResponse.json(
        {
          error: error.message || "Stripe request failed.",
          type: error.type,
          code: error.code || null,
          param: error.param || null,
        },
        { status: 400 }
      );
    }

    console.error("Create Stripe session error:", error);

    return NextResponse.json(
      { error: "Unable to create payment session." },
      { status: 500 }
    );
  }
}