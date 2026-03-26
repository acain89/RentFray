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
            recurringFees: {
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

    const payments = await prisma.payment.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: "desc" },
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

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    for (const p of payments) {
      const amount = centsToDollars(p.amountCents);

      switch (p.status as PaymentLifecycleStatus) {
        case "PAID":
          paidTotal += amount;
          if (new Date(p.updatedAt) >= todayStart) {
            paymentSummary.paidToday++;
          }
          break;
        case "PENDING":
          pendingTotal += amount;
          paymentSummary.pending++;
          break;
        case "PROCESSING":
          processingTotal += amount;
          paymentSummary.processing++;
          break;
        case "FAILED":
          failedTotal += amount;
          paymentSummary.failed++;
          break;
        case "REFUNDED":
          refundedTotal += amount;
          paymentSummary.refunded++;
          break;
      }
    }

    const paymentIssuesRaw = payments
      .filter((p) =>
        ["FAILED", "PROCESSING", "PENDING", "REFUNDED"].includes(p.status)
      )
      .slice(0, 25);

    const paymentIssues: PaymentIssueRow[] = paymentIssuesRaw.map((p) => ({
      id: p.id,
      unitId: p.unitId,
      amountCents: p.amountCents,
      status: p.status as PaymentLifecycleStatus,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    const paymentMap = new Map<string, PaymentIssueRow>(
      paymentIssues
        .filter((p) => Boolean(p.unitId))
        .map((p) => [p.unitId as string, p])
    );

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

        if (activeAssignment) occupiedUnits++;
        else vacantUnits++;

        const baseRent = roundMoney(
          Number(unit.tier?.baseRent ?? unit.baseRent ?? 0)
        );

        const recurring = roundMoney(
          unit.recurringFees.reduce(
            (sum, fee) => sum + Number(fee.amount || 0),
            0
          )
        );

        const subtotal = roundMoney(baseRent + recurring);

        if (activeAssignment) totalExpected += subtotal;

        const collected = roundMoney(paymentSumMap.get(unit.id) || 0);
        totalCollected += collected;

        const [ledger, delinquency] = await Promise.all([
          getUnitLedgerSummary(unit.id),
          getUnitDelinquencySummary(unit.id),
        ]);

        if (delinquency.isDelinquent) delinquentCount++;

        const payment = paymentMap.get(unit.id);

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          tenantName: activeAssignment
            ? `${activeAssignment.firstName || ""} ${
                activeAssignment.lastName || ""
              }`.trim()
            : null,
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
          totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
      },
      units,
    });
  } catch (error) {
    console.error("dashboard error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}