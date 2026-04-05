import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { formatCentsToDollars } from "@/lib/billingConfig";
import { getActiveUnitIds } from "@/lib/unitFilters";

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

type PropertyUnit = {
  id: string;
  unitNumber: string;
  isActive: boolean;
  tier: { name: string } | null;
  tenantAssignments: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  }[];
};

type CycleSnapshot = {
  billingCycleLabel: string;
  occupiedUnitsLabel: string;
  portalPaidCount: number;
  manualPaidCount: number;
  totalPaidCount: number;
  unpaidUnitsCount: number;
  totalCollected: number;
  totalExpected: number;
  collectionRate: number;
  difference: number;
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

function getMonthWindow(date: Date): {
  start: Date;
  next: Date;
  billingCycle: string;
  label: string;
} {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const billingCycle = `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
  const label = start.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  return { start, next, billingCycle, label };
}

function isPortalPaymentMethod(method: string | null | undefined): boolean {
  const normalized = String(method ?? "").toUpperCase();
  return normalized === "ACH" || normalized === "CARD";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

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

    const property = await prisma.property.findFirst({
      where: { id: session.propertyId },
      include: {
        units: {
          where: includeInactive ? {} : { isActive: true },
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

    const activePropertyUnits = property.units.filter(
      (unit: PropertyUnit) => unit.isActive
    );
    const activeUnitIds = getActiveUnitIds(property.units);

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const cycleWindow = getMonthWindow(now);

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

    const cycleLedgerPayments = await prisma.ledgerEntry.findMany({
      where: {
        propertyId: property.id,
        entryType: "PAYMENT",
        voidedAt: null,
        effectiveDate: {
          gte: cycleWindow.start,
          lt: cycleWindow.next,
        },
      },
      orderBy: [
        { unitId: "asc" },
        { effectiveDate: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        unitId: true,
        paymentMethod: true,
        effectiveDate: true,
        createdAt: true,
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

    let occupiedUnits = 0;
    let vacantUnits = 0;
    let totalExpectedCents = 0;
    let totalCollectedCents = 0;
    let delinquentCount = 0;

    const allUnits = await Promise.all(
      property.units.map(async (unit: PropertyUnit) => {
        const activeAssignment = unit.tenantAssignments[0] ?? null;
        const shouldCountInActiveMath = unit.isActive;

        if (shouldCountInActiveMath) {
          if (activeAssignment) {
            occupiedUnits++;
          } else {
            vacantUnits++;
          }
        }

        const [ledger, delinquency] = await Promise.all([
          getUnitLedgerSummary(unit.id, activeAssignment?.id),
          getUnitDelinquencySummary(unit.id),
        ]);

        if (shouldCountInActiveMath) {
          totalExpectedCents += Math.max(0, ledger.totalChargesCents);
          totalCollectedCents += Math.max(0, ledger.totalPaidCents);

          if (delinquency.isDelinquent) {
            delinquentCount++;
          }
        }

        const latestPayment = payments.find(
          (p: (typeof payments)[number]) => p.unitId === unit.id
        );
        const paymentStatus = normalizePaymentStatus(latestPayment?.status);

        let resolvedStatus: PaymentStatus = "UNPAID";

        if (paymentStatus === "FAILED") {
          resolvedStatus = "FAILED";
        } else if (paymentStatus === "PENDING") {
          resolvedStatus = "PENDING";
        } else if (activeAssignment && ledger.balanceCents <= 0) {
          resolvedStatus = "PAID";
        } else if (delinquency.isDelinquent) {
          resolvedStatus = "REVERSED";
        } else if (ledger.balanceCents > 0) {
          resolvedStatus = "UNPAID";
        }

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          isActive: unit.isActive,
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

    const units = allUnits.filter(
      (unit) => unit.tenantName && (unit.isActive || includeInactive)
    );

    const totalExpected = centsToNumber(totalExpectedCents);
    const totalCollected = centsToNumber(totalCollectedCents);

    let portalPaidCount = 0;
    let manualPaidCount = 0;

    const countedUnits = new Set<string>();

    for (const payment of cycleLedgerPayments) {
      if (countedUnits.has(payment.unitId)) continue;
      if (!activeUnitIds.has(payment.unitId)) continue;

      if (isPortalPaymentMethod(payment.paymentMethod)) {
        portalPaidCount++;
      } else {
        manualPaidCount++;
      }

      countedUnits.add(payment.unitId);
    }

    const totalPaidCount = portalPaidCount + manualPaidCount;
    const unpaidUnitsCount = Math.max(0, occupiedUnits - totalPaidCount);

    const cycleSnapshot: CycleSnapshot = {
      billingCycleLabel: cycleWindow.label,
      occupiedUnitsLabel: `${occupiedUnits}/${activePropertyUnits.length}`,
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
      difference: Number((totalCollected - totalExpected).toFixed(2)),
    };

    const totalUnitsCount = await prisma.unit.count({
      where: {
        propertyId: property.id,
        isActive: true,
      },
    });

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
        totalUnits: totalUnitsCount,
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
      cycleSnapshot,
      units,
    });
  } catch (error) {
    console.error("dashboard error", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}