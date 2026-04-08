import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { formatCentsToDollars } from "@/lib/billingConfig";
import { getCapacitySnapshot } from "@/lib/propertyCapacity";

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

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
        unitCount: true,
        managementUsers: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            email: true,
            username: true,
            displayName: true,
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

    const capacity = await getCapacitySnapshot(property.id);

    /**
     * 🔑 CRITICAL FIX:
     * ONLY pull units that ACTUALLY HAVE TENANTS
     */
    const units = await prisma.unit.findMany({
      where: {
        propertyId: property.id,
        isActive: true,
        tenantAssignments: {
          some: {
            isCurrent: true,
            moveOutDate: null,
          },
        },
      },
      orderBy: { unitNumber: "asc" },
      select: {
        id: true,
        unitNumber: true,
        tier: {
          select: {
            name: true,
          },
        },
        tenantAssignments: {
          where: { isCurrent: true, moveOutDate: null },
          take: 1,
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    let occupiedUnits = 0;
let totalExpectedCents = 0;
let totalCollectedCents = 0;
let delinquentCount = 0;
let unpaidUnitsCount = 0;
let portalPaidCount = 0;
let manualPaidCount = 0;
let totalPaidCount = 0;

    const resolvedUnits = await Promise.all(
      units.map(async (unit: (typeof units)[number]) => {
        const assignment = unit.tenantAssignments[0] ?? null;

        if (!assignment) return null;

        occupiedUnits++;

        const [ledger, delinquency, payments] = await Promise.all([
  getUnitLedgerSummary(unit.id, assignment.id),
  getUnitDelinquencySummary(unit.id),
  prisma.payment.findMany({
    where: {
      unitId: unit.id,
      tenantAssignmentId: assignment.id,
      status: "PAID",
    },
    select: {
      paymentMethod: true,
    },
  }),
]);

        totalExpectedCents += Math.max(0, ledger.totalChargesCents);
        totalCollectedCents += Math.max(0, ledger.totalPaidCents);

        if (delinquency.isDelinquent) {
          delinquentCount++;
        }
         
        if (ledger.balanceCents > 0) {
  unpaidUnitsCount++;
} else {
  totalPaidCount++;

  const hasManual = payments.some(
  (p: { paymentMethod: string | null }) => p.paymentMethod === "MANUAL"
);
const hasPortal = payments.some(
  (p: { paymentMethod: string | null }) => p.paymentMethod === "ACH"
);

  if (hasManual) manualPaidCount++;
  else if (hasPortal) portalPaidCount++;
}
    
        let paymentStatus: PaymentStatus = "UNPAID";

/**
 * STEP 1: Detect most recent payment status (operational state)
 */
const lastPayment = await prisma.payment.findFirst({
  where: {
    unitId: unit.id,
    tenantAssignmentId: assignment.id,
  },
  orderBy: { createdAt: "desc" },
  select: { status: true },
});

const latestStatus = lastPayment?.status ?? null;

/**
 * PRIORITY ORDER:
 * FAILED > PENDING > PAID > DELINQUENT > UNPAID
 */

if (latestStatus === "FAILED") {
  paymentStatus = "FAILED";
} else if (latestStatus === "PENDING") {
  paymentStatus = "PENDING";
} else if (ledger.balanceCents <= 0) {
  paymentStatus = "PAID";
} else if (delinquency.isDelinquent) {
  paymentStatus = "UNPAID"; // still unpaid, frontend handles red
} else {
  paymentStatus = "UNPAID";
}

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          tenantName: `${assignment.firstName ?? ""} ${
            assignment.lastName ?? ""
          }`.trim(),
          balanceCents: ledger.balanceCents,
          balance: formatCentsToDollars(ledger.balanceCents),
          totalPaid: formatCentsToDollars(ledger.totalPaidCents),
          isDelinquent: Boolean(delinquency.isDelinquent),
          daysPastDue: Number(delinquency.daysPastDue || 0),
          paymentStatus,
          tierName: unit.tier?.name ?? "Units",
        };
      })
    );

    const finalUnits = resolvedUnits.filter(
      (u): u is NonNullable<typeof u> => u !== null
    );

    const totalExpected = Math.round(totalExpectedCents) / 100;
    const totalCollected = Math.round(totalCollectedCents) / 100;

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        code: property.propertyCode,
        unitCount: capacity.effectiveUnitCount,
        managementUsers: property.managementUsers,
      },
      session: {
        role: session.role,
      },
      summary: {
        totalUnits: capacity.effectiveUnitCount,
        occupiedUnits,
        vacantUnits: Math.max(0, capacity.effectiveUnitCount - occupiedUnits),
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
      cycleSnapshot: {
        billingCycleLabel: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        occupiedUnitsLabel: `${occupiedUnits} / ${capacity.effectiveUnitCount}`,
        portalPaidCount,
        manualPaidCount,
        totalPaidCount,
        unpaidUnitsCount,
        totalCollected,
        totalExpected,
        collectionRate:
          totalExpected > 0
            ? Number(((totalCollected / totalExpected) * 100).toFixed(1))
            : 0,
        difference: totalCollected - totalExpected,
      },
      units: finalUnits,
    });
  } catch (error) {
    console.error("dashboard error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}