import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";
import { assertTierBillingCalendar } from "@/lib/billingCalendar";
import { getRentDateSummary, resolveEffectiveBillingSettings } from "@/lib/rentDates";
import { lockManualRows, ManualOperationError, isManualLockContention } from "@/lib/manualFinancialOperations";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type AdjustType = "CHARGE" | "CREDIT";

function isAdjustType(value: string): value is AdjustType {
  return value === "CHARGE" || value === "CREDIT";
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const propertyId = session.propertyId;
    const body = await req.json();

    const unitId = String(body.unitId || "").trim();
    const tenantAssignmentId = typeof body.tenantAssignmentId === "string" ? body.tenantAssignmentId.trim() : "";
    const rawType = String(body.type || "").trim().toUpperCase();
    if (rawType === "PRORATION") {
      return NextResponse.json({ ok: false, error: "Manual move-in proration has been retired. Tenant activation and the billing calendar determine first-cycle rent." }, { status: 410 });
    }
    const amount = Number(body.amount);
    const memo = String(body.memo || "").trim();

    if (!unitId || !tenantAssignmentId || !isAdjustType(rawType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockManualRows(tx, propertyId, unitId, tenantAssignmentId, []);
    const unit = await tx.unit.findFirst({
      where: {
        id: unitId,
        propertyId,
      },
      include: {
        tier: true,
        property: { include: { settings: true } },
      },
    });

    if (!unit) {
      throw new ManualOperationError("Unit not found", 404);
    }

    const assignment = await tx.tenantAssignment.findFirst({
      where: { id: tenantAssignmentId, propertyId, unitId: unit.id, isCurrent: true },
      select: { id: true },
    });

    if (!assignment) {
      throw new ManualOperationError("The displayed tenant assignment is no longer current.");
    }

    // ============================
    // STANDARD ADJUSTMENTS
    // ============================
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ManualOperationError("Invalid amount", 400);
    }

    const amountCents = Math.round(amount * 100);

    let entryType: "CHARGE" | "CREDIT";
    let chargeType: "RENT" | "RECURRING_FEE" | "OTHER_FEE" | null;
    let defaultMemo: string;

    if (rawType === "CHARGE") {
      entryType = "CHARGE";
      chargeType = "OTHER_FEE";
      defaultMemo = "One-time charge";
    } else {
      entryType = "CREDIT";
      chargeType = null;
      defaultMemo = "Credit";
    }

    const effectiveDate = new Date();
    const permanentDueDay = assertTierBillingCalendar({
      propertyId: unit.propertyId,
      rentFrayStartDate: unit.property.rentFrayStartDate,
      propertySettingsDueDay: unit.property.settings?.rentDueDay,
      tier: unit.tier,
    });
    const effective = resolveEffectiveBillingSettings({
      tier: unit.tier,
      propertySettings: unit.property.settings,
    });
    const { billingCycle } = getRentDateSummary({
      ...effective,
      dueDay: permanentDueDay,
      now: effectiveDate,
      rentFrayStartDate: unit.property.rentFrayStartDate,
    });

    await tx.ledgerEntry.create({
      data: {
        propertyId,
        unitId: unit.id,
        tenantAssignmentId: assignment.id,
        entryType,
        chargeType,
        amountCents,
        memo: memo || defaultMemo,
        effectiveDate,
        billingCycle,
        createdByManagementUserId: session.managementUserId ?? null,
      },
    });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ManualOperationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (isManualLockContention(error)) {
      return NextResponse.json({ ok: false, error: "Tenancy is busy. Refresh and try again." }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: "Failed to adjust balance" },
      { status: 500 }
    );
  }
}
