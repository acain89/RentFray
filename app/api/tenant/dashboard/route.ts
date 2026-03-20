// app/api/tenant/dashboard/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { getSession } from "@/lib/session";

export async function POST() {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT" || !session.unitId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
        assignments: {
          where: { moveOut: null },
          orderBy: { moveIn: "desc" },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
              },
            },
          },
          take: 1,
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

    if (!activeTenant || !activeAssignment) {
      return NextResponse.json(
        { error: "No active tenant for unit" },
        { status: 400 }
      );
    }

    const [summary, delinquency] = await Promise.all([
      getUnitLedgerSummary(unit.id),
      getUnitDelinquencySummary(unit.id),
    ]);

    const propertyStatus = String(unit.property?.status || "PREVIEW").toUpperCase();
    const paymentEnabled = propertyStatus === "LIVE";
    const moveInTime = new Date(activeAssignment.moveIn).getTime();

    const currentLedger = unit.ledgerEntries.filter((entry) => {
      const entryTime = new Date(entry.effectiveDate).getTime();
      const sameTenantOrUnitLevel =
        !entry.tenantId || entry.tenantId === activeTenant.id;

      return entryTime >= moveInTime && sameTenantOrUnitLevel;
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
    console.error("POST /api/tenant/dashboard failed", err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}