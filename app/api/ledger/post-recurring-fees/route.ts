// app/api/ledger/post-recurring-fees/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export async function POST() {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const effectiveDate = startOfDay(now);
    const monthStart = startOfMonth(now);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
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
            },
            recurringFees: {
              where: { isActive: true },
              orderBy: { displayOrder: "asc" },
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    let posted = 0;
    let skipped = 0;

    for (const unit of property.units) {
      const activeAssignment = unit.tenantAssignments[0];

      if (!activeAssignment) {
        skipped += unit.recurringFees.length;
        continue;
      }

      for (const fee of unit.recurringFees) {
        const amount = Number(fee.amount || 0);
        const label = String(fee.label || "").trim();

        if (!label || amount <= 0) {
          skipped += 1;
          continue;
        }

        const memo = `${label} - ${monthLabel}`;

        const existing = await prisma.ledgerEntry.findFirst({
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

        await prisma.ledgerEntry.create({
          data: {
            propertyId: property.id,
            unitId: unit.id,
            tenantAssignmentId: activeAssignment.id,
            entryType: "CHARGE",
            chargeType: "RECURRING_FEE",
            amount,
            effectiveDate,
            memo,
            createdByManagementUserId: session.managementUserId || null,
          },
        });

        posted += 1;
      }
    }

    await prisma.auditLog.create({
      data: {
        propertyId: property.id,
        actorType: "MANAGER",
        actorManagementUserId: session.managementUserId || null,
        action: "RECURRING_FEES_POSTED",
        targetType: "PROPERTY",
        targetId: property.id,
        summary: `Manual recurring fee posting completed for ${monthLabel}.`,
        metadataJson: JSON.stringify({
          posted,
          skipped,
          monthStart: monthStart.toISOString(),
          triggeredAt: effectiveDate.toISOString(),
        }),
      },
    });

    return NextResponse.json({ ok: true, posted, skipped });
  } catch (error) {
    console.error("POST /api/ledger/post-recurring-fees error:", error);
    return NextResponse.json(
      { error: "Failed to post recurring fees" },
      { status: 500 }
    );
  }
}