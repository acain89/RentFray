// [path: app/api/tenant/dashboard/route.ts]

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

export async function POST() {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT" || !session.unitId || !session.propertyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: session.unitId },
      select: {
        id: true,
        unitNumber: true,
        property: {
          select: {
            id: true,
            name: true,
            propertyCode: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      );
    }

    const [ledger, delinquency] = await Promise.all([
      getUnitLedgerSummary(unit.id),
      getUnitDelinquencySummary(unit.id),
    ]);

    return NextResponse.json({
      ok: true,
      property: {
        id: unit.property.id,
        name: unit.property.name,
        propertyCode: unit.property.propertyCode,
      },
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
      },
      balance: Number(ledger.balance || 0),
      delinquency: {
        isDelinquent: Boolean(delinquency.isDelinquent),
        daysPastDue: Number(delinquency.daysPastDue || 0),
      },
    });
  } catch (error) {
    console.error("tenant dashboard POST error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}