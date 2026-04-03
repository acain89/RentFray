import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";
import { getRentDateSummary, resolveEffectiveBillingSettings } from "@/lib/rentDates";

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

   
    const property = await prisma.property.findUnique({
  where: { id: session.propertyId },
  include: {
    settings: true,
    units: {
      where: { isActive: true },
      include: {
        tenantAssignments: {
          where: { isCurrent: true },
          orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { id: true },
        },
        recurringFeeItems: {
          where: { isActive: true },
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            label: true,
            amountCents: true,
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

     const now = new Date();
    const effectiveDate = safeDate(startOfDay(now));
    const rentDates = getRentDateSummary({
  ...resolveEffectiveBillingSettings({
    tier: null,
    propertySettings: property.settings,
  }),
  now,
});

const billingCycle = rentDates.billingCycle;
const monthLabel = getMonthLabel(now);
    const existingEntries = await prisma.ledgerEntry.findMany({
      where: {
        propertyId: property.id,
        entryType: "CHARGE",
        chargeType: "RECURRING_FEE",
        billingCycle,
        voidedAt: null,
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
          skipped += unit.recurringFeeItems.length;
          continue;
        }

        for (const fee of unit.recurringFeeItems) {
          const amountCents = fee.amountCents ?? 0; // ✅ FIX
          const label = clean(fee.label);

          if (!label || amountCents <= 0) {
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
              billingCycle,
              voidedAt: null,
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
              amountCents,
              effectiveDate,
              billingCycle: billingCycle,
              memo,
              createdByManagementUserId:
                session.managementUserId ?? null,
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
          actorManagementUserId:
            session.managementUserId ?? null,
          action: "RECURRING_FEES_POSTED",
          targetType: "PROPERTY",
          targetId: property.id,
          summary: `Recurring fees posted for ${monthLabel}`,
          metadataJson: JSON.stringify({
            posted,
            skipped,
            billingCycle: billingCycle,
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