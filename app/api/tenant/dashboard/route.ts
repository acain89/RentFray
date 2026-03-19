import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const unitId = String(body.unitId || "").trim();

    if (!unitId) {
      return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: true,
        assignments: {
          where: { moveOut: null },
          orderBy: { moveIn: "desc" },
          include: { tenant: true },
        },
        ledgerEntries: {
          orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
          take: 50,
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const activeAssignment = unit.assignments[0] ?? null;
    const activeTenant = activeAssignment?.tenant ?? null;

    if (!activeTenant) {
      return NextResponse.json(
        { error: "No active tenant for unit" },
        { status: 400 }
      );
    }

    const summary = await getUnitLedgerSummary(unit.id);
    const delinquency = await getUnitDelinquencySummary(unit.id);

    const propertyStatus = String(unit.property?.status || "PREVIEW").toUpperCase();
    const paymentEnabled = propertyStatus === "LIVE";

    const currentLedger = unit.ledgerEntries.filter((entry) => {
      const entryDate = new Date(entry.effectiveDate).getTime();
      const moveInDate = new Date(activeAssignment.moveIn).getTime();
      const sameTenantOrUnitLevel =
        !entry.tenantId || entry.tenantId === activeTenant.id;

      return entryDate >= moveInDate && sameTenantOrUnitLevel;
    });

    return NextResponse.json({
      ok: true,
      tenantId: activeTenant.id,
      tenantName: activeTenant.name,
      propertyId: unit.propertyId,
      propertyName: unit.property?.name || "",
      propertyCode: unit.property?.code || "",
      propertyStatus,
      paymentEnabled,
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      balance: Number(summary.balance || 0),
      totalPaid: Number(summary.totalPaid || 0),
      isDelinquent: Boolean(delinquency.isDelinquent),
      ledger: currentLedger.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amount: Number(entry.amount || 0),
        effectiveDate: entry.effectiveDate,
        memo: entry.memo,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}