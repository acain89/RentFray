// [path: app/api/tenant/balance/route.ts]

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

export async function GET() {
  try {
    const session = await getSession();

    if (
      !session ||
      session.role !== "TENANT" ||
      !session.unitId ||
      !session.propertyId
    ) {
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
            propertyCode: true,
          },
        },
        tenantAssignments: {
          where: {
            isCurrent: true,
          },
          orderBy: {
            moveInDate: "desc",
          },
          take: 1,
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

    const activeAssignment = unit.tenantAssignments[0] || null;

    return NextResponse.json({
      ok: true,
      property: unit.property,
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        unitType: unit.unitType,
        baseRent: Number(unit.baseRent || 0),
        isActive: Boolean(unit.isActive),
        portalActivated: Boolean(unit.portalActivated),
      },
      tenant: activeAssignment
        ? {
            id: activeAssignment.id,
            name: [activeAssignment.firstName, activeAssignment.lastName]
              .filter(Boolean)
              .join(" "),
            email: activeAssignment.email,
            phone: activeAssignment.phone,
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