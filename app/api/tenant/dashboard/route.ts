import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { getProcessingFee } from "@/lib/billingConfig";

type DashboardLedgerEntry = {
  id: string;
  type: string;
  amount: number;
  effectiveDate: string;
  memo: string | null;
};

type StatementItem = {
  label: string;
  amount: number;
};

function roundMoney(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildTenantName(firstName: string | null, lastName: string | null) {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || "Tenant";
}

function isTenantPaymentEnabled(propertyStatus: string): boolean {
  return propertyStatus.trim().toUpperCase() === "LIVE";
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

    // ✅ INCLUDE tier + tier fees + unit fees
  const unit = await prisma.unit.findFirst({
  where: {
    id: session.unitId,
    propertyId: session.propertyId,
  },
  include: {
    tier: {
      include: {
        charges: {
          where: { isActive: true },
        },
      },
    },
    recurringFeeItems: {
      where: { isActive: true },
    },
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
        orderBy: [{ effectiveDate: "desc" }],
      }),
      getUnitDelinquencySummary(unit.id),
    ]);

    // =========================
    // BASE RENT
    // =========================

    const baseRent = roundMoney(
      Number(unit.tier?.baseRent ?? unit.baseRent ?? 0)
    );

    // =========================
    // CHARGES (TIER + UNIT)
    // =========================

    const tierCharges = unit.tier?.charges ?? [];
    const unitCharges = unit.recurringFeeItems ?? [];

    const configuredCharges = roundMoney(
      [
        ...tierCharges.map((f) => Number(f.amount || 0)),
        ...unitCharges.map((f) => Number(f.amount || 0)),
      ].reduce((sum, val) => sum + val, 0)
    );

    // =========================
    // LEDGER (PAYMENTS / LATE FEES)
    // =========================

    let lateFees = 0;
    let credits = 0;
    let totalPaid = 0;

    const statementItems: StatementItem[] = [];

    for (const entry of ledgerEntries) {
      const amount = roundMoney(Number(entry.amount || 0));
      const memo = String(entry.memo || "").toLowerCase();

      if (entry.entryType === "CHARGE" && memo.includes("late")) {
        lateFees += amount;
        statementItems.push({ label: "Late Fee", amount });
      }

      if (entry.entryType === "PAYMENT") {
        credits += amount;
        totalPaid += amount;
        statementItems.push({ label: "Payment", amount: -amount });
      }

      if (entry.entryType === "CREDIT") {
        credits += amount;
        statementItems.push({ label: "Credit", amount: -amount });
      }
    }

    // =========================
    // SUBTOTAL
    // =========================

    const subtotal = roundMoney(baseRent + configuredCharges + lateFees);

    // =========================
    // PROCESSING FEE (DYNAMIC)
    // =========================

    const processingFee = getProcessingFee(subtotal);

    // =========================
    // TOTAL
    // =========================

    const totalDue = roundMoney(
      Math.max(0, subtotal + processingFee - credits)
    );

    // =========================
    // DATE LOGIC (REAL CALENDAR)
    // =========================

    const today = new Date();
    const dueDay = 1;
    const graceDays = 5;

    const dueDate =
      today.getDate() > dueDay
        ? new Date(today.getFullYear(), today.getMonth() + 1, dueDay)
        : new Date(today.getFullYear(), today.getMonth(), dueDay);

    const graceEndsOn = new Date(dueDate);
    graceEndsOn.setDate(graceEndsOn.getDate() + graceDays);

    // =========================
    // RESPONSE
    // =========================

    return NextResponse.json({
      ok: true,

      tenantName: buildTenantName(
        unit.portalFirstName,
        unit.portalLastName
      ),

      propertyName: unit.property.name,
      propertyStatus: unit.property.status,
      paymentEnabled: isTenantPaymentEnabled(unit.property.status),

      unitNumber: unit.unitNumber,
      unitId: unit.id,

      balance: totalDue,
      totalPaid,
      isDelinquent: Boolean(delinquency.isDelinquent),

      dueDate: dueDate.toISOString(),
      graceEndsOn: graceEndsOn.toISOString(),

      statement: {
        rent: baseRent,
        recurringCharges: configuredCharges,
        lateFees,
        processingFee, // ✅ now included
        credits,
        subtotal,
        totalDue,
        items: statementItems,
      },

      ledger: ledgerEntries.map((entry) => ({
        id: entry.id,
        type: entry.entryType,
        amount: roundMoney(Number(entry.amount || 0)),
        effectiveDate: entry.effectiveDate.toISOString(),
        memo: entry.memo ?? null,
      })),
    });
  } catch (error) {
    console.error("POST /api/tenant/dashboard failed", error);

    return NextResponse.json(
      { error: "Failed to load dashboard." },
      { status: 500 }
    );
  }
}