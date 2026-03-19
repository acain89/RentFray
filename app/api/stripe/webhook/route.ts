import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { allocatePayment } from "@/lib/paymentAllocation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const unitId = String(session.metadata?.unitId || "").trim();
    const amount = Number(session.metadata?.amount || 0);

    if (!unitId || amount <= 0) {
      return NextResponse.json({ error: "Bad metadata" }, { status: 400 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: true,
        assignments: {
          where: { moveOut: null },
          include: { tenant: true },
        },
        ledgerEntries: {
          orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!unit) return NextResponse.json({ ok: true });

    const propertyStatus = String(unit.property?.status || "PREVIEW").toUpperCase();
    if (propertyStatus !== "LIVE") {
      return NextResponse.json({ ok: true });
    }

    const tenant = unit.assignments[0]?.tenant;
    if (!tenant) return NextResponse.json({ ok: true });

    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        source: "STRIPE",
        sourceRef: session.id,
      },
    });

    if (existing) {
      return NextResponse.json({ received: true });
    }

    const { allocations } = allocatePayment(
      amount,
      unit.ledgerEntries.map((e) => ({
        id: e.id,
        amount: Number(e.amount || 0),
        type: e.type,
        effectiveDate: e.effectiveDate,
      }))
    );

    const payment = await prisma.ledgerEntry.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantId: tenant.id,
        type: "PAYMENT",
        amount: -Math.abs(amount),
        effectiveDate: new Date(),
        memo: `Stripe payment (${session.id})`,
        source: "STRIPE",
        sourceRef: session.id,
      },
    });

    if (allocations.length > 0) {
      await prisma.paymentAllocation.createMany({
        data: allocations.map((a) => ({
          paymentId: payment.id,
          ledgerEntryId: a.chargeId,
          amount: a.applied,
        })),
      });
    }
  }

  return NextResponse.json({ received: true });
}