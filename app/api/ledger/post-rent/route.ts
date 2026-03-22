// app/api/ledger/post-rent/route.ts

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
            tier: true,
            tenantAssignments: {
              where: { isCurrent: true },
              orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
              take: 1,
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
        skipped += 1;
        continue;
      }

      const amount = Number(unit.tier?.baseRent ?? unit.baseRent ?? 0);

      if (amount <= 0) {
        skipped += 1;
        continue;
      }

      const existingRent = await prisma.ledgerEntry.findFirst({
        where: {
          propertyId: property.id,
          unitId: unit.id,
          tenantAssignmentId: activeAssignment.id,
          entryType: "CHARGE",
          chargeType: "RENT",
          effectiveDate: {
            gte: monthStart,
            lt: nextMonth,
          },
        },
        select: { id: true },
      });

      if (existingRent) {
        skipped += 1;
        continue;
      }

      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          tenantAssignmentId: activeAssignment.id,
          entryType: "CHARGE",
          chargeType: "RENT",
          amount,
          memo: `Monthly rent - ${monthLabel}`,
          effectiveDate,
          createdByManagementUserId: session.managementUserId || null,
        },
      });

      posted += 1;
    }

    await prisma.auditLog.create({
      data: {
        propertyId: property.id,
        actorType: "MANAGER",
        actorManagementUserId: session.managementUserId || null,
        action: "RENT_POSTED",
        targetType: "PROPERTY",
        targetId: property.id,
        summary: `Manual rent posting completed for ${monthLabel}.`,
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
    console.error("POST /api/ledger/post-rent error:", error);
    return NextResponse.json({ error: "Failed to post rent" }, { status: 500 });
  }
}