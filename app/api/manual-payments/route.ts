import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allocatePayment } from "@/lib/allocatePayment";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const unitId = String(body.unitId || "");
    const amount = Number(body.amount || 0);

    if (!unitId || !amount) {
      return NextResponse.json(
        { error: "Missing unitId or amount" },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        assignments: {
          where: { moveOut: null },
          include: { tenant: true },
        },
        ledgerEntries: {
          orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const tenant = unit.assignments[0]?.tenant;

    if (!tenant) {
      return NextResponse.json(
        { error: "No active tenant" },
        { status: 400 }
      );
    }

    const { allocations, remaining } = allocatePayment(
      amount,
      unit.ledgerEntries.map((e: (typeof unit.ledgerEntries)[number]) => ({
        id: e.id,
        amount: Number(e.amount || 0),
        type: e.type,
      }))
    );

    await prisma.ledgerEntry.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantId: tenant.id,
        type: "MANUAL_PAYMENT",
        amount: -Math.abs(amount),
        effectiveDate: new Date(),
        memo: "Manual payment",
        source: "MANUAL",
      },
    });

    return NextResponse.json({
      ok: true,
      allocations,
      remaining,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to post manual payment" },
      { status: 500 }
    );
  }
}