// app/api/manager/dashboard/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

type PaymentLifecycleStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

type PaymentIssueRow = {
  id: string;
  unitId: string | null;
  amountCents: number;
  status: PaymentLifecycleStatus;
  createdAt: Date;
  updatedAt: Date;
};

type PaymentGroupByRow = {
  unitId: string | null;
  _sum: {
    amount: number | null;
  };
};

function roundMoney(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

function centsToDollars(cents: number): number {
  return roundMoney(cents / 100);
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
          orderBy: { unitNumber: "asc" },
          include: {
            tier: true,
            recurringFeeItems: {
              where: { isActive: true },
              orderBy: { displayOrder: "asc" },
            },
            tenantAssignments: {
              where: {
                isCurrent: true,
                moveOutDate: null,
              },
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const payments = await prisma.payment.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        unitId: true,
        amountCents: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let paidTotal = 0;
    let pendingTotal = 0;
    let processingTotal = 0;
    let failedTotal = 0;
    let refundedTotal = 0;

    const paymentSummary = {
      pending: 0,
      processing: 0,
      failed: 0,
      refunded: 0,
      paidToday: 0,
    };

    for (const payment of payments) {
      const amount = centsToDollars(payment.amountCents);

      switch (payment.status as PaymentLifecycleStatus) {
        case "PAID":
          paidTotal += amount;
          if (new Date(payment.updatedAt) >= todayStart) {
            paymentSummary.paidToday += 1;
          }
          break;
        case "PENDING":
          pendingTotal += amount;
          paymentSummary.pending += 1;
          break;
        case "PROCESSING":
          processingTotal += amount;
          paymentSummary.processing += 1;
          break;
        case "FAILED":
          failedTotal += amount;
          paymentSummary.failed += 1;
          break;
        case "REFUNDED":
          refundedTotal += amount;
          paymentSummary.refunded += 1;
          break;
      }
    }

    const paymentIssuesRaw = payments
      .filter((payment) =>
        ["FAILED", "PROCESSING", "PENDING", "REFUNDED"].includes(payment.status)
      )
      .slice(0, 25);

    const paymentIssues: PaymentIssueRow[] = paymentIssuesRaw.map((payment) => ({
      id: payment.id,
      unitId: payment.unitId,
      amountCents: payment.amountCents,
      status: payment.status as PaymentLifecycleStatus,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    }));

    const paymentMap = new Map<string, PaymentIssueRow>();
    for (const issue of paymentIssues) {
      if (issue.unitId && !paymentMap.has(issue.unitId)) {
        paymentMap.set(issue.unitId, issue);
      }
    }

    const paymentSumsRaw = await prisma.ledgerEntry.groupBy({
      by: ["unitId"],
      where: {
        propertyId: property.id,
        entryType: "PAYMENT",
        amount: { lt: 0 },
        effectiveDate: { gte: monthStart },
        voidedAt: null,
      },
      _sum: {
        amount: true,
      },
    });

    const paymentSums = paymentSumsRaw as PaymentGroupByRow[];

    const paymentSumMap = new Map<string, number>(
      paymentSums
        .filter((row) => Boolean(row.unitId))
        .map((row) => [
          row.unitId as string,
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
          occupiedUnits += 1;
        } else {
          vacantUnits += 1;
        }

        const baseRent = roundMoney(
          Number(unit.tier?.baseRent ?? unit.baseRent ?? 0)
        );

        const recurring = roundMoney(
          unit.recurringFeeItems.reduce(
            (sum, fee) => sum + Number(fee.amount || 0),
            0
          )
        );

        const subtotal = roundMoney(baseRent + recurring);

        if (activeAssignment) {
          totalExpected += subtotal;
        }

        const collected = roundMoney(paymentSumMap.get(unit.id) || 0);
        totalCollected += collected;

        const [ledger, delinquency] = await Promise.all([
          getUnitLedgerSummary(unit.id),
          getUnitDelinquencySummary(unit.id),
        ]);

        if (delinquency.isDelinquent) {
          delinquentCount += 1;
        }

        const payment = paymentMap.get(unit.id);

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          tenantName: activeAssignment
            ? `${activeAssignment.firstName || ""} ${
                activeAssignment.lastName || ""
              }`.trim()
            : null,
          baseRent,
          recurringCharges: recurring,
          expectedThisMonth: subtotal,
          collectedThisMonth: collected,
          balance: roundMoney(Number(ledger.balance || 0)),
          isDelinquent: Boolean(delinquency.isDelinquent),
          daysPastDue: Number(delinquency.daysPastDue || 0),
          paymentStatus: payment?.status || null,
          tierName: unit.tier?.name || "Units",
        };
      })
    );

    totalExpected = roundMoney(totalExpected);
    totalCollected = roundMoney(totalCollected);

   // --- BUILD TIERS ---
const tierMap = new Map<string, { id: string; name: string; unitCount: number }>();

for (const unit of property.units) {
  const tierId = unit.tier?.id || "default";
  const tierName = unit.tier?.name || "Units";

  if (!tierMap.has(tierId)) {
    tierMap.set(tierId, {
      id: tierId,
      name: tierName,
      unitCount: 0,
    });
  }

  const tier = tierMap.get(tierId)!;
  tier.unitCount += 1;
}

const tiers = Array.from(tierMap.values());


// --- BUILD PAYMENTS (SV + FV USE THIS) ---
const paymentsFormatted = payments
  .filter((p) => p.status === "PAID")
  .map((p) => {
    const unit = property.units.find((u) => u.id === p.unitId);

    return {
      id: p.id,
      unitNumber: unit?.unitNumber || "—",
      tierId: unit?.tier?.id || "default",
      tierName: unit?.tier?.name || "Units",
      amount: centsToDollars(p.amountCents),
      createdAt: p.createdAt.toISOString(),
      lastName: unit?.tenantAssignments?.[0]?.lastName || "",
    };
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
        totalUnits: property.units.length,
        occupiedUnits,
        vacantUnits,
        delinquentUnits: delinquentCount,
      },
      financials: {
        expected: totalExpected,
        collected: totalCollected,
        collectionRate:
          totalExpected > 0
            ? roundMoney((totalCollected / totalExpected) * 100)
            : 0,
        paidTotal: roundMoney(paidTotal),
        pendingTotal: roundMoney(pendingTotal),
        processingTotal: roundMoney(processingTotal),
        failedTotal: roundMoney(failedTotal),
        refundedTotal: roundMoney(refundedTotal),
      },
      paymentSummary,
      paymentIssues,
      units,
      tiers,
      payments: paymentsFormatted,
    });
  } catch (error) {
    console.error("dashboard error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}