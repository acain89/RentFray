import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const unitId = String(body.unitId || "").trim();
    const rawAmount = Number(body.amount || 0);

    if (!unitId || rawAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment request" },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: true,
        assignments: {
          where: { moveOut: null },
          include: { tenant: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const propertyStatus = String(unit.property?.status || "PREVIEW").toUpperCase();
    if (propertyStatus !== "LIVE") {
      return NextResponse.json(
        { error: "Payments are disabled for this property." },
        { status: 403 }
      );
    }

    const tenant = unit.assignments[0]?.tenant;
    if (!tenant) {
      return NextResponse.json(
        { error: "No active tenant" },
        { status: 400 }
      );
    }

    const summary = await getUnitLedgerSummary(unit.id);
    const balance = Number(summary.balance || 0);

    if (balance <= 0) {
      return NextResponse.json({ error: "No balance due" }, { status: 400 });
    }

    const amount = Number(rawAmount.toFixed(2));

    if (amount > balance) {
      return NextResponse.json(
        { error: "Amount exceeds current balance" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Rent Payment - Unit ${unit.unitNumber}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        unitId: unit.id,
        tenantId: tenant.id,
        amount: String(amount),
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}