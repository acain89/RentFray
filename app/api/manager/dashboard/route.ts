// app/api/manager/dashboard/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "MANAGER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const propertyId = session.propertyId;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        units: {
          include: {
            assignments: {
              where: { moveOut: null },
              include: { tenant: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    let totalUnits = property.units.length;
    let occupiedUnits = 0;
    let vacantUnits = 0;

    let totalExpected = 0;
    let totalCollected = 0;

    let delinquentCount = 0;

    const unitSummaries = [];

    for (const unit of property.units) {
      const activeAssignment = unit.assignments[0] ?? null;

      if (activeAssignment) {
        occupiedUnits++;
      } else {
        vacantUnits++;
      }

      const ledger = await getUnitLedgerSummary(unit.id);
      const delinquency = await getUnitDelinquencySummary(unit.id);

      const rent = Number(unit.marketRent || 0);

      totalExpected += rent;

      // CRITICAL FIX: only count payments THIS MONTH
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );

      const monthPayments = await prisma.ledgerEntry.aggregate({
        where: {
          unitId: unit.id,
          amount: { lt: 0 },
          effectiveDate: { gte: monthStart },
        },
        _sum: {
          amount: true,
        },
      });

      const collectedForUnit = Math.abs(
        Number(monthPayments._sum.amount || 0)
      );

      totalCollected += collectedForUnit;

      if (delinquency.isDelinquent) {
        delinquentCount++;
      }

      unitSummaries.push({
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        tenantName: activeAssignment?.tenant?.fullName || null,
        balance: ledger.balance,
        isDelinquent: delinquency.isDelinquent,
        daysPastDue: delinquency.daysPastDue,
      });
    }

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        code: property.code,
      },
      summary: {
        totalUnits,
        occupiedUnits,
        vacantUnits,
        delinquentUnits: delinquentCount,
      },
      financials: {
        expected: totalExpected,
        collected: totalCollected,
        collectionRate:
          totalExpected > 0 ? totalCollected / totalExpected : 0,
      },
      units: unitSummaries.sort((a, b) => {
        if (a.isDelinquent && !b.isDelinquent) return -1;
        if (!a.isDelinquent && b.isDelinquent) return 1;
        return a.unitNumber.localeCompare(b.unitNumber);
      }),
    });
  } catch (error) {
    console.error("manager dashboard GET error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}