// app/api/ledger/post-recurring-fees/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export async function POST() {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const property = await prisma.property.findUnique({
      where: { id: session.propertyId },
      include: {
        units: {
          include: {
            assignments: {
              where: { moveOut: null },
              take: 1,
            },
            recurringFees: true,
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
      if (unit.assignments.length === 0) {
        skipped += 1;
        continue;
      }

      for (const fee of unit.recurringFees) {
        const description = `${fee.name} - ${monthStart.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}`;

        const existing = await prisma.ledgerEntry.findFirst({
          where: {
            propertyId: property.id,
            unitId: unit.id,
            type: "OTHER_FEE",
            description,
            effectiveDate: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        });

        if (existing) {
          skipped += 1;
          continue;
        }

        await prisma.ledgerEntry.create({
          data: {
            propertyId: property.id,
            unitId: unit.id,
            type: "OTHER_FEE",
            amount: Number(fee.amount || 0),
            description,
            effectiveDate: monthStart,
          },
        });

        posted += 1;
      }
    }

    await prisma.auditLog.create({
      data: {
        propertyId: property.id,
        actorRole: session.role,
        actorLabel: session.managementUserId || "management",
        action: "RECURRING_FEES_POSTED",
        entityType: "PROPERTY",
        entityId: property.id,
        notes: JSON.stringify({
          posted,
          skipped,
          month: monthStart.toISOString(),
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