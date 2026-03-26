// app/api/ledger/post-recurring-fees/route.ts

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function toMoney(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeDate(date: Date): Date {
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function POST() {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();
    const effectiveDate = safeDate(startOfDay(now));
    const monthStart = safeDate(startOfMonth(now));
    const nextMonth = safeDate(getNextMonth(now));
    const monthLabel = getMonthLabel(now);

    const property = await prisma.property.findUnique({
      where: { id: session.propertyId },
      include: {
        units: {
          where: { isActive: true },
          include: {
            tenantAssignments: {
              where: { isCurrent: true },
              orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: { id: true },
            },
            recurringFees: {
              where: { isActive: true },
              orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
              select: {
                id: true,
                label: true,
                amount: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Property not found" },
        { status: 404 }
      );
    }

    const existingEntries = await prisma.ledgerEntry.findMany({
      where: {
        propertyId: property.id,
        entryType: "CHARGE",
        chargeType: "RECURRING_FEE",
        effectiveDate: {
          gte: monthStart,
          lt: nextMonth,
        },
      },
      select: {
        unitId: true,
        tenantAssignmentId: true,
        memo: true,
      },
    });

    const existingKeys = new Set<string>(
  existingEntries.map(
    (entry: (typeof existingEntries)[number]) =>
      `${entry.unitId}::${entry.tenantAssignmentId ?? ""}::${clean(
        entry.memo
      )}`
  )
);

    let posted = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const unit of property.units) {
        const activeAssignment = unit.tenantAssignments[0] ?? null;

        if (!activeAssignment) {
          skipped += unit.recurringFees.length;
          continue;
        }

        for (const fee of unit.recurringFees) {
          const amount = toMoney(fee.amount);
          const label = clean(fee.label);

          if (!label || amount <= 0) {
            skipped += 1;
            continue;
          }

          const memo = `${label} - ${monthLabel}`;
          const key = `${unit.id}::${activeAssignment.id}::${memo}`;

          if (existingKeys.has(key)) {
            skipped += 1;
            continue;
          }

          const existing = await tx.ledgerEntry.findFirst({
            where: {
              propertyId: property.id,
              unitId: unit.id,
              tenantAssignmentId: activeAssignment.id,
              entryType: "CHARGE",
              chargeType: "RECURRING_FEE",
              memo,
              effectiveDate: {
                gte: monthStart,
                lt: nextMonth,
              },
            },
            select: { id: true },
          });

          if (existing) {
            skipped += 1;
            continue;
          }

          await tx.ledgerEntry.create({
            data: {
              propertyId: property.id,
              unitId: unit.id,
              tenantAssignmentId: activeAssignment.id,
              entryType: "CHARGE",
              chargeType: "RECURRING_FEE",
              amount,
              effectiveDate,
              memo,
              createdByManagementUserId: session.managementUserId ?? null,
            },
          });

          existingKeys.add(key);
          posted += 1;
        }
      }

      await tx.auditLog.create({
        data: {
          propertyId: property.id,
          actorType: "MANAGER",
          actorManagementUserId: session.managementUserId ?? null,
          action: "RECURRING_FEES_POSTED",
          targetType: "PROPERTY",
          targetId: property.id,
          summary: `Recurring fees posted for ${monthLabel}`,
          metadataJson: JSON.stringify({
            posted,
            skipped,
            monthStart: monthStart.toISOString(),
            triggeredAt: effectiveDate.toISOString(),
          }),
        },
      });
    });

    return NextResponse.json<ApiSuccess<{ posted: number; skipped: number }>>({
      ok: true,
      data: {
        posted,
        skipped,
      },
    });
  } catch (error) {
    console.error("POST /api/ledger/post-recurring-fees error:", error);

    return NextResponse.json<ApiError>(
      { ok: false, error: "Failed to post recurring fees" },
      { status: 500 }
    );
  }
}