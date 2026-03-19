// app/api/tenant/balance/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

export async function GET() {
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
          },
        },
        assignments: {
          where: { moveOut: null },
          orderBy: { moveIn: "desc" },
          include: {
            tenant: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const ledger = await getUnitLedgerSummary(unit.id);
    const delinquency = await getUnitDelinquencySummary(unit.id);

    const activeAssignment = unit.assignments[0] || null;

    return NextResponse.json({
      ok: true,
      property: unit.property,
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        squareFeet: unit.squareFeet,
        marketRent: unit.marketRent,
      },
      tenant: activeAssignment?.tenant || null,
      balance: {
        currentBalance: ledger.balance,
        totalCharges: ledger.totalCharges,
        totalPaid: ledger.totalPaid,
        lastPaymentDate: ledger.lastPaymentDate,
        lastPaymentAmount: ledger.lastPaymentAmount,
      },
      delinquency: {
        isDelinquent: delinquency.isDelinquent,
        daysPastDue: delinquency.daysPastDue,
        lateFeesOwed: delinquency.lateFeesOwed,
        unpaidRent: delinquency.unpaidRent,
      },
    });
  } catch (error) {
    console.error("tenant balance GET error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}