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
          take: 1,
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const [ledger, delinquency] = await Promise.all([
      getUnitLedgerSummary(unit.id),
      getUnitDelinquencySummary(unit.id),
    ]);

    const activeAssignment = unit.assignments[0] || null;

    return NextResponse.json({
      ok: true,
      property: unit.property,
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        tier: unit.tier,
        occupancyStatus: unit.occupancyStatus,
        marketRent: Number(unit.marketRent || 0),
      },
      tenant: activeAssignment?.tenant
        ? {
            id: activeAssignment.tenant.id,
            name: activeAssignment.tenant.name,
            email: activeAssignment.tenant.email,
            phone: activeAssignment.tenant.phone,
          }
        : null,
      balance: {
        currentBalance: Number(ledger.balance || 0),
        totalCharges: Number(ledger.totalCharges || 0),
        totalPaid: Number(ledger.totalPaid || 0),
        lastPaymentDate: ledger.lastPaymentDate,
        lastPaymentAmount: Number(ledger.lastPaymentAmount || 0),
      },
      delinquency: {
        isDelinquent: Boolean(delinquency.isDelinquent),
        daysPastDue: Number(delinquency.daysPastDue || 0),
        lateFeesOwed: Number(delinquency.lateFeesOwed || 0),
        unpaidRent: Number(delinquency.unpaidRent || 0),
      },
    });
  } catch (error) {
    console.error("GET /api/tenant/balance failed", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}