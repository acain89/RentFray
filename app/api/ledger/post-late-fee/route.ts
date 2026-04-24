import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/financialAccess";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { Prisma } from "@prisma/client";
import {

getRentDateSummary,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
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

    const property = await prisma.property.findUnique({
      where: { id: session.propertyId },
      include: {
        settings: true,
        units: {
          where: { isActive: true },
          include: {
            tier: {
              select: {
                rentDueDay: true,
                gracePeriodDays: true,
                lateFeeInitialCents: true,
                lateFeeDailyCents: true,
                maxLateFeeDays: true,
              },
            },
            tenantAssignments: {
              where: { isCurrent: true },
              orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
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

    const now = new Date();
    const effectiveDate = safeDate(startOfDay(now));
    const billingCycle = `${effectiveDate.getFullYear()}-${String(
      effectiveDate.getMonth() + 1
    ).padStart(2, "0")}`;
    const monthLabel = getMonthLabel(now);

    const existingFees = await prisma.ledgerEntry.findMany({
      where: {
        propertyId: property.id,
        entryType: "CHARGE",
        chargeType: "LATE_FEE",
        billingCycle,
        voidedAt: null,
      },
      select: {
        unitId: true,
        tenantAssignmentId: true,
      },
    });

    const existingKeys = new Set<string>(
      existingFees.map(
        (entry: (typeof existingFees)[number]) =>
          `${entry.unitId}::${entry.tenantAssignmentId ?? ""}`
      )
    );

    const delinquencyMap = new Map<string, boolean>();

    for (const unit of property.units) {
      const result = await getUnitDelinquencySummary(unit.id, now);
      delinquencyMap.set(unit.id, Boolean(result?.isDelinquent));
    }

    let posted = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const unit of property.units) {
        const assignment = unit.tenantAssignments[0] ?? null;

        if (!assignment) {
          skipped++;
          continue;
        }

        const isDelinquent = delinquencyMap.get(unit.id);

        if (!isDelinquent) {
          skipped++;
          continue;
        }

        const effective = resolveEffectiveBillingSettings({
          tier: unit.tier,
          propertySettings: property.settings,
        });

        const feeCents = effective.lateFeeInitialCents;

        if (feeCents <= 0) {
          skipped++;
          continue;
        }

        const key = `${unit.id}::${assignment.id}`;

        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        const rentDates = getRentDateSummary({
          ...resolveEffectiveBillingSettings({
            tier: unit.tier,
            propertySettings: property.settings,
          }),
          now,
        });

        const graceCutoff = new Date(rentDates.graceEndsOn);

        const existingPayment = await tx.payment.findFirst({
          where: {
            unitId: unit.id,
            billingCycle,
            status: {
              in: ["PENDING", "PAID"],
            },
            createdAt: {
              lte: graceCutoff,
            },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (existingPayment) {
          skipped++;
          continue;
        }

        const exists = await tx.ledgerEntry.findFirst({
          where: {
            propertyId: property.id,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "LATE_FEE",
            billingCycle,
            voidedAt: null,
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
            chargeType: "LATE_FEE",
            amountCents: feeCents,
            memo: `Late fee - ${monthLabel}`,
            effectiveDate,
            billingCycle,
            createdByManagementUserId: session.managementUserId ?? null,
          },
        });

        posted++;
      }

      await tx.auditLog.create({
        data: {
          propertyId: property.id,
          actorType: "MANAGER",
          actorManagementUserId: session.managementUserId ?? null,
          action: "LATE_FEES_POSTED",
          targetType: "PROPERTY",
          targetId: property.id,
          summary: `Late fees posted for ${monthLabel}`,
          metadataJson: JSON.stringify({
            posted,
            skipped,
            billingCycle,
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
    console.error("POST /api/ledger/post-late-fee error:", error);

    return NextResponse.json<ApiError>(
      { ok: false, error: "Failed to post late fees" },
      { status: 500 }
    );
  }
}
