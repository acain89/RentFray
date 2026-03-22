// [path: app/api/tenant/dashboard/route.ts]

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export async function POST() {
  try {
    const session = await getSession();

    if (
      !session ||
      session.role !== "TENANT" ||
      !session.unitId ||
      !session.propertyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      select: {
        id: true,
        unitNumber: true,
        tier: {
          select: {
            id: true,
            name: true,
            processingFee: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            propertyCode: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const [ledger, delinquency] = await Promise.all([
      getUnitLedgerSummary(unit.id),
      getUnitDelinquencySummary(unit.id),
    ]);

    const currentBalance = roundMoney(Math.max(0, Number(ledger.balance || 0)));
    const processingFee = roundMoney(Number(unit.tier?.processingFee || 0));
    const totalIfPaidNow = roundMoney(currentBalance + processingFee);

    return NextResponse.json({
      ok: true,
      property: {
        id: unit.property.id,
        name: unit.property.name,
        propertyCode: unit.property.propertyCode,
      },
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        tier: unit.tier
          ? {
              id: unit.tier.id,
              name: unit.tier.name,
            }
          : null,
      },
      balance: {
        currentBalance,
        processingFee,
        totalIfPaidNow,
      },
      delinquency: {
        isDelinquent: Boolean(delinquency.isDelinquent),
        daysPastDue: Number(delinquency.daysPastDue || 0),
      },
    });
  } catch (error) {
    console.error("tenant dashboard POST error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}