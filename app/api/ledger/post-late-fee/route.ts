import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { getPropertySettings } from "@/lib/propertySettings";
import { getLateFeePreview } from "@/lib/lateFees";

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
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const activeTenant = unit.assignments[0]?.tenant;

    // ✅ HARD GUARD
    if (!activeTenant) {
      return NextResponse.json(
        { error: "No active tenant for unit" },
        { status: 400 }
      );
    }

    const summary = await getUnitLedgerSummary(unit.id);
    const delinquency = await getUnitDelinquencySummary(unit.id);
    const settings = await getPropertySettings(unit.propertyId);

    const preview = getLateFeePreview({
      balance: summary.balance,
      isDelinquent: delinquency.isDelinquent,
      settings,
    });

    // ❌ not eligible
    if (!preview.eligible) {
      return NextResponse.json(
        { error: "Late fee not eligible" },
        { status: 400 }
      );
    }

    // ❌ invalid amount
    if (!preview.recommendedLateFee || preview.recommendedLateFee <= 0) {
      return NextResponse.json(
        { error: "Invalid late fee amount" },
        { status: 400 }
      );
    }

    // ❌ duplicate same day
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        unitId: unit.id,
        type: "LATE_FEE",
        effectiveDate: new Date(),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Late fee already posted for today" },
        { status: 400 }
      );
    }

    // ✅ POST
    await prisma.ledgerEntry.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantId: activeTenant.id,
        type: "LATE_FEE",
        amount: Number(preview.recommendedLateFee),
        effectiveDate: new Date(),
        memo: "Late fee",
        source: "SYSTEM",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to post late fee" },
      { status: 500 }
    );
  }
}