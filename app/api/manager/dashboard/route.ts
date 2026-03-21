// [path: app/api/manager/dashboard/route.ts]

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
      (session.role !== "OWNER" &&
        session.role !== "MANAGER" &&
        session.role !== "STAFF") ||
      !session.propertyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const property = await prisma.property.findUnique({
      where: { id: session.propertyId },
      select: {
        id: true,
        name: true,
        propertyCode: true,
        units: {
          orderBy: { unitNumber: "asc" },
          select: {
            id: true,
            unitNumber: true,
            baseRent: true,
            tenantAssignments: {
              where: {
                isCurrent: true,
                moveOutDate: null,
              },
              orderBy: { moveInDate: "desc" },
              take: 1,
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const paymentSums = await prisma.ledgerEntry.groupBy({
  by: ["unitId"],
  where: {
    propertyId: property.id,
    amount: { lt: 0 },
    effectiveDate: { gte: monthStart },
  },
  _sum: {
    amount: true,
  },
});

    const paymentMap = new Map(
      paymentSums.map((row) => [
        row.unitId,
        Math.abs(Number(row._sum.amount || 0)),
      ])
    );

    let occupiedUnits = 0;
    let vacantUnits = 0;
    let totalExpected = 0;
    let totalCollected = 0;
    let delinquentCount = 0;

    const units = await Promise.all(
      property.units.map(async (unit) => {
        const activeAssignment = unit.tenantAssignments[0] ?? null;

        if (activeAssignment) {
          occupiedUnits++;
        } else {
          vacantUnits++;
        }

        const rent = Number(unit.baseRent || 0);
        totalExpected += rent;

        const collectedForUnit = paymentMap.get(unit.id) || 0;
        totalCollected += collectedForUnit;

        const [ledger, delinquency] = await Promise.all([
          getUnitLedgerSummary(unit.id),
          getUnitDelinquencySummary(unit.id),
        ]);

        if (delinquency.isDelinquent) {
          delinquentCount++;
        }

        const tenantName = activeAssignment
          ? [activeAssignment.firstName, activeAssignment.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() || null
          : null;

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          tenantName,
          balance: Number(ledger.balance || 0),
          isDelinquent: Boolean(delinquency.isDelinquent),
          daysPastDue: Number(delinquency.daysPastDue || 0),
        };
      })
    );

    units.sort((a, b) => {
      if (a.isDelinquent && !b.isDelinquent) return -1;
      if (!a.isDelinquent && b.isDelinquent) return 1;

      return a.unitNumber.localeCompare(b.unitNumber, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        propertyCode: property.propertyCode,
      },
      summary: {
        totalUnits: property.units.length,
        occupiedUnits,
        vacantUnits,
        delinquentUnits: delinquentCount,
      },
      financials: {
        expected: totalExpected,
        collected: totalCollected,
        collectionRate: totalExpected > 0 ? totalCollected / totalExpected : 0,
      },
      units,
    });
  } catch (error) {
    console.error("manager dashboard GET error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}