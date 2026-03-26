// [path: app/api/tenant/dashboard/route.ts]

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

type DashboardLedgerEntry = {
  id: string;
  type: string;
  amount: number;
  effectiveDate: string;
  memo: string | null;
};

function roundMoney(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildTenantName(
  firstName: string | null,
  lastName: string | null
): string {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || "Tenant";
}

function isTenantPaymentEnabled(propertyStatus: string): boolean {
  const normalized = propertyStatus.trim().toUpperCase();
  return normalized === "LIVE";
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
        portalFirstName: true,
        portalLastName: true,
        property: {
          select: {
            id: true,
            name: true,
            propertyCode: true,
            status: true,
            isActive: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found." }, { status: 404 });
    }

    const [ledgerEntries, delinquency] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: {
          propertyId: session.propertyId,
          unitId: session.unitId,
          voidedAt: null,
        },
        select: {
          id: true,
          entryType: true,
          amount: true,
          effectiveDate: true,
          memo: true,
        },
        orderBy: {
          effectiveDate: "desc",
        },
      }),
      getUnitDelinquencySummary(unit.id),
    ]);

    let runningBalance = 0;
    let totalPaid = 0;

    for (const entry of ledgerEntries) {
      const amount = Number(entry.amount || 0);

      if (entry.entryType === "CHARGE") {
        runningBalance += amount;
      } else if (
        entry.entryType === "PAYMENT" ||
        entry.entryType === "CREDIT"
      ) {
        runningBalance -= amount;

        if (entry.entryType === "PAYMENT") {
          totalPaid += amount;
        }
      }
    }

    const ledger: DashboardLedgerEntry[] = ledgerEntries.map((entry) => ({
      id: entry.id,
      type: entry.entryType,
      amount: roundMoney(Number(entry.amount || 0)),
      effectiveDate: entry.effectiveDate.toISOString(),
      memo: entry.memo ?? null,
    }));

    const propertyStatus = String(unit.property.status ?? "");

    return NextResponse.json({
      ok: true,
      tenantName: buildTenantName(
        unit.portalFirstName ?? null,
        unit.portalLastName ?? null
      ),
      propertyName: unit.property.name,
      propertyStatus,
      paymentEnabled: isTenantPaymentEnabled(propertyStatus),
      unitNumber: unit.unitNumber,
      unitId: unit.id,
      balance: roundMoney(Math.max(0, runningBalance)),
      totalPaid: roundMoney(totalPaid),
      isDelinquent: Boolean(delinquency.isDelinquent),
      ledger,
    });
  } catch (error: unknown) {
    console.error("POST /api/tenant/dashboard failed", error);

    return NextResponse.json(
      { error: "Failed to load dashboard." },
      { status: 500 }
    );
  }
}