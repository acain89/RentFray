// app/api/ledger/post-late-fee/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/financialAccess";

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
        settings: true,
        units: {
          include: {
            assignments: {
              where: { moveOut: null },
              take: 1,
            },
          },
        },
      },
    });

    if (!property || !property.settings) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const lateFeeAmount = Number(property.settings.lateFeeDefault ?? 0);

    if (lateFeeAmount <= 0) {
      return NextResponse.json({ error: "Late fee default is not configured" }, { status: 400 });
    }

    let posted = 0;
    let skipped = 0;

    for (const unit of property.units) {
      const occupied = unit.assignments.length > 0;
      if (!occupied) {
        skipped += 1;
        continue;
      }

      const existingLateFee = await prisma.ledgerEntry.findFirst({
        where: {
          propertyId: property.id,
          unitId: unit.id,
          type: "LATE_FEE",
          effectiveDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      if (existingLateFee) {
        skipped += 1;
        continue;
      }

      const monthEntries = await prisma.ledgerEntry.findMany({
        where: {
          propertyId: property.id,
          unitId: unit.id,
          effectiveDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      const balance = monthEntries.reduce((sum, row) => sum + Number(row.amount || 0), 0);

      if (balance <= 0) {
        skipped += 1;
        continue;
      }

      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          type: "LATE_FEE",
          amount: lateFeeAmount,
          description: `Late fee - ${monthStart.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}`,
          effectiveDate: now,
        },
      });

      posted += 1;
    }

    await prisma.auditLog.create({
      data: {
        propertyId: property.id,
        actorRole: session.role,
        actorLabel: session.managementUserId || "management",
        action: "LATE_FEES_POSTED",
        entityType: "PROPERTY",
        entityId: property.id,
        notes: JSON.stringify({
          posted,
          skipped,
          month: monthStart.toISOString(),
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      posted,
      skipped,
    });
  } catch (error) {
    console.error("POST /api/ledger/post-late-fee error:", error);
    return NextResponse.json({ error: "Failed to post late fees" }, { status: 500 });
  }
}