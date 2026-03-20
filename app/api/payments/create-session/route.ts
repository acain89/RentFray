// app/api/payments/create-session/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";

function getOrigin(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

function toCents(amount: number) {
  return Math.round(Number(amount || 0) * 100);
}

function moneyNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT" || !session.unitId || !session.propertyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
            paymentConnectionStatus: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const ledger = await getUnitLedgerSummary(unit.id);
    const baseAmountDue = Math.max(0, Number(ledger?.balance || 0));

    if (baseAmountDue <= 0) {
      return NextResponse.json({ error: "No balance due" }, { status: 400 });
    }

    const convenienceFee = moneyNumber(unit.property.settings?.convenienceFee || 0);
    const totalAmountDue = moneyNumber(baseAmountDue + convenienceFee);

    const paymentStatus = unit.property.paymentConnectionStatus;

    const paymentReady = Boolean(
      paymentStatus?.stripeConnected &&
        paymentStatus?.achEnabled &&
        paymentStatus?.onboardingComplete &&
        paymentStatus?.adminApproved
    );

    if (!paymentReady) {
      return NextResponse.json(
        { error: "Payments are not enabled for this property yet." },
        { status: 400 }
      );
    }

    const origin = getOrigin(req);

    if (unit.property.status !== "LIVE") {
      return NextResponse.json({
        ok: true,
        preview: true,
        message: "Property is not LIVE yet. Payment session not created.",
        baseAmountDue,
        convenienceFee,
        totalAmountDue,
      });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (!stripeSecretKey) {
      return NextResponse.json({
        ok: true,
        preview: true,
        message: "Stripe is not configured yet. Payment session not created.",
        baseAmountDue,
        convenienceFee,
        totalAmountDue,
      });
    }

    const Stripe = require("stripe");
    const stripe = new Stripe(stripeSecretKey);

    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `RentFray Balance - Unit ${unit.unitNumber}`,
          },
          unit_amount: toCents(baseAmountDue),
        },
        quantity: 1,
      },
    ];

    if (convenienceFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Convenience Fee",
          },
          unit_amount: toCents(convenienceFee),
        },
        quantity: 1,
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["us_bank_account"],
      line_items: lineItems,
      success_url: `${origin}/tenant/pay?success=1`,
      cancel_url: `${origin}/tenant/pay?canceled=1`,
      metadata: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        tenantName: unit.tenantName || "",
        source: "tenant_pay_now",
        baseAmountDue: String(baseAmountDue),
        convenienceFee: String(convenienceFee),
        totalAmountDue: String(totalAmountDue),
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: unit.propertyId,
        actorRole: "TENANT",
        actorLabel: unit.unitNumber,
        action: "TENANT_PAYMENT_SESSION_CREATED",
        entityType: "UNIT",
        entityId: unit.id,
        notes: JSON.stringify({
          baseAmountDue,
          convenienceFee,
          totalAmountDue,
          checkoutSessionId: checkoutSession.id,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      preview: false,
      checkoutUrl: checkoutSession.url,
      baseAmountDue,
      convenienceFee,
      totalAmountDue,
    });
  } catch (error) {
    console.error("POST /api/payments/create-session error:", error);
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 500 }
    );
  }
}