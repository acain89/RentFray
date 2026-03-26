// app/api/ledger/post-rent/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

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

function safeDate(d: Date): Date {
  return Number.isNaN(d.getTime()) ? new Date() : d;
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
            tier: {
              select: { baseRent: true },
            },
            tenantAssignments: {
              where: { isCurrent: true },
              orderBy: [
                { moveInDate: "desc" },
                { createdAt: "desc" },
              ],
              take: 1,
              select: { id: true },
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

    // --- PRE-FETCH EXISTING (FIRST DEFENSE) ---
    const existingRents = await prisma.ledgerEntry.findMany({
      where: {
        propertyId: property.id,
        entryType: "CHARGE",
        chargeType: "RENT",
        effectiveDate: {
          gte: monthStart,
          lt: nextMonth,
        },
      },
      select: {
        unitId: true,
        tenantAssignmentId: true,
      },
    });

   const existingKeys = new Set<string>(
  existingRents.map(
    (e: (typeof existingRents)[number]) =>
      `${e.unitId}::${e.tenantAssignmentId ?? ""}`
  )
);

    let posted = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const unit of property.units) {
        const assignment = unit.tenantAssignments[0] ?? null;

        if (!assignment) {
          skipped++;
          continue;
        }

        const rawAmount =
          unit.tier?.baseRent ?? (unit as { baseRent?: number }).baseRent ?? 0;

        const amount = toMoney(rawAmount);

        if (amount <= 0) {
          skipped++;
          continue;
        }

        const key = `${unit.id}::${assignment.id}`;

        // --- PREVENT DUPLICATE (FAST PATH) ---
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        // --- RACE CONDITION PROTECTION ---
        const exists = await tx.ledgerEntry.findFirst({
          where: {
            propertyId: property.id,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "RENT",
            effectiveDate: {
              gte: monthStart,
              lt: nextMonth,
            },
          },
          select: { id: true },
        });

        if (exists) {
          skipped++;
          continue;
        }

        await tx.ledgerEntry.create({
          data: {
            propertyId: property.id,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "RENT",
            amount,
            memo: `Monthly rent - ${monthLabel}`,
            effectiveDate,
            createdByManagementUserId:
              session.managementUserId ?? null,
          },
        });

        posted++;
      }

      await tx.auditLog.create({
        data: {
          propertyId: property.id,
          actorType: "MANAGER",
          actorManagementUserId:
            session.managementUserId ?? null,
          action: "RENT_POSTED",
          targetType: "PROPERTY",
          targetId: property.id,
          summary: `Rent posted for ${monthLabel}`,
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
      data: { posted, skipped },
    });
  } catch (error) {
    console.error("POST /api/ledger/post-rent error:", error);

    return NextResponse.json<ApiError>(
      { ok: false, error: "Failed to post rent" },
      { status: 500 }
    );
  }
}