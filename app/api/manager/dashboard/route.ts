// app/api/manager/dashboard/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { formatCentsToDollars } from "@/lib/billingConfig";

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

type PropertyUnit = {
  id: string;
  unitNumber: string;
  tier: { name: string } | null;
  tenantAssignments: {
  id: string;
  firstName: string | null;
  lastName: string | null;
}[];
};

function centsToNumber(cents: number): number {
  return Math.round(cents) / 100;
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = String(value ?? "").toUpperCase();

  if (
    status === "PENDING" ||
    status === "PAID" ||
    status === "FAILED" ||
    status === "REVERSED"
  ) {
    return status;
  }

  return "UNPAID";
}

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
  include: {
    units: {
      where: {
        tenantAssignments: {
          some: {
            isCurrent: true,
            moveOutDate: null,
          },
        },
      },
      orderBy: { unitNumber: "asc" },
      include: {
        tier: true,
        tenantAssignments: {
          where: { isCurrent: true, moveOutDate: null },
          take: 1,
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
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // ========================================================
    // PAYMENTS (STATUS ONLY — NOT FINANCIAL SOURCE)
    // ========================================================

    const payments = await prisma.payment.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: "desc" },
      select: {
        unitId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const paymentSummary = {
      pending: 0,
      failed: 0,
      reversed: 0,
      paidToday: 0,
    };

    for (const payment of payments) {
      const status = normalizePaymentStatus(payment.status);

      if (status === "PENDING") paymentSummary.pending++;
      if (status === "FAILED") paymentSummary.failed++;
      if (status === "REVERSED") paymentSummary.reversed++;
      if (status === "PAID" && payment.updatedAt >= todayStart) {
        paymentSummary.paidToday++;
      }
    }

    // ========================================================
    // UNITS (LEDGER = SOURCE OF TRUTH)
    // ========================================================

    let occupiedUnits = 0;
    let vacantUnits = 0;
    let totalExpectedCents = 0;
    let totalCollectedCents = 0;
    let delinquentCount = 0;

    const units = await Promise.all(
      property.units.map(async (unit: PropertyUnit) => {
        const activeAssignment = unit.tenantAssignments[0] ?? null;

        if (activeAssignment) occupiedUnits++;
        else vacantUnits++;

        const [ledger, delinquency] = await Promise.all([
          getUnitLedgerSummary(unit.id, activeAssignment?.id),
          getUnitDelinquencySummary(unit.id),
        ]);

        totalExpectedCents += Math.max(0, ledger.totalChargesCents);
        totalCollectedCents += Math.max(0, ledger.totalPaidCents);

        if (delinquency.isDelinquent) {
          delinquentCount++;
        }

       const latestPayment = payments.find(
  (p: (typeof payments)[number]) => p.unitId === unit.id
);
        const paymentStatus = normalizePaymentStatus(latestPayment?.status);

        // 🔒 TRUE STATUS (LEDGER FIRST)
        let resolvedStatus: PaymentStatus = "UNPAID";

        if (ledger.balanceCents <= 0) {
          resolvedStatus = "PAID";
        } else if (paymentStatus === "PENDING") {
          resolvedStatus = "PENDING";
        } else if (paymentStatus === "FAILED") {
          resolvedStatus = "FAILED";
        } else if (paymentStatus === "REVERSED") {
          resolvedStatus = "REVERSED";
        }

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          tenantName: activeAssignment
            ? `${activeAssignment.firstName ?? ""} ${
                activeAssignment.lastName ?? ""
              }`.trim()
            : null,

          balanceCents: ledger.balanceCents,
          balance: formatCentsToDollars(ledger.balanceCents),

          totalPaidCents: ledger.totalPaidCents,
          totalPaid: formatCentsToDollars(ledger.totalPaidCents),

          isDelinquent: Boolean(delinquency.isDelinquent),
          daysPastDue: Number(delinquency.daysPastDue || 0),

          paymentStatus: resolvedStatus,

          tierName: unit.tier?.name || "Units",
        };
      })
    );

    // ========================================================
    // FINAL (LEDGER-BASED)
    // ========================================================

    const totalExpected = centsToNumber(totalExpectedCents);
    const totalCollected = centsToNumber(totalCollectedCents);

    return NextResponse.json({
      ok: true,

      property: {
        id: property.id,
        name: property.name,
        code: property.propertyCode,
      },

      session: {
        role: session.role,
      },

      summary: {
        totalUnits: units.length,
        occupiedUnits,
        vacantUnits,
        delinquentUnits: delinquentCount,
      },

      financials: {
        expected: totalExpected,
        collected: totalCollected,
        collectionRate:
          totalExpected > 0
            ? Math.round((totalCollected / totalExpected) * 100)
            : 0,
      },

      paymentSummary,

      units,
    });
  } catch (error) {
    console.error("dashboard error", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}