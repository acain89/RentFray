import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPropertySettings } from "@/lib/propertySettings";
import { getRentPreview } from "@/lib/rentPreview";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const unitId = String(body.unitId || "");

    if (!unitId) {
      return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
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

    const activeTenant = unit.assignments[0]?.tenant;

    // ✅ HARD GUARD: tenant required
    if (!activeTenant) {
      return NextResponse.json(
        { error: "No active tenant for unit" },
        { status: 400 }
      );
    }

    const settings = await getPropertySettings(unit.propertyId);

    const preview = getRentPreview({
      billingDay: settings.billingDay,
      marketRent: Number(unit.marketRent || 0),
      ledgerEntries: unit.ledgerEntries.map((entry) => ({
        type: entry.type,
        effectiveDate: entry.effectiveDate,
        amount: Number(entry.amount || 0),
      })),
    });

    // ❌ already posted
    if (preview.hasChargeThisCycle) {
      return NextResponse.json(
        { error: "Rent already posted for this cycle" },
        { status: 400 }
      );
    }

    // ❌ no valid charge
    if (!preview.upcomingCharge) {
      return NextResponse.json(
        { error: "No valid rent charge available" },
        { status: 400 }
      );
    }

    // ❌ duplicate safety
    const duplicate = await prisma.ledgerEntry.findFirst({
      where: {
        unitId: unit.id,
        type: "RENT_CHARGE",
        effectiveDate: preview.upcomingCharge.effectiveDate,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Rent already posted for this billing date" },
        { status: 400 }
      );
    }

    // ✅ POST
    await prisma.ledgerEntry.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantId: activeTenant.id,
        type: "RENT_CHARGE",
        amount: Number(preview.upcomingCharge.amount),
        effectiveDate: preview.upcomingCharge.effectiveDate,
        memo: "Rent charge",
        source: "SYSTEM",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to post rent" },
      { status: 500 }
    );
  }
}