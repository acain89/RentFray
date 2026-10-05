import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type AdjustType = "CHARGE" | "CREDIT";

function isAdjustType(value: string): value is AdjustType {
  return value === "CHARGE" || value === "CREDIT";
}

/**
 * Normalize a date to YYYY-MM (cycle key)
 */
function getCycleKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${m.toString().padStart(2, "0")}`;
}

function getNextCycleKey(cycleKey: string): string {
  const [yearRaw, monthRaw] = cycleKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return getCycleKey(new Date());
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
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

    const body = await req.json();

    const unitId = String(body.unitId || "").trim();
    const rawType = String(body.type || "").trim().toUpperCase();
    if (rawType === "PRORATION") {
      return NextResponse.json({ ok: false, error: "Manual move-in proration has been retired. Tenant activation and the billing calendar determine first-cycle rent." }, { status: 410 });
    }
    const amount = Number(body.amount);
    const memo = String(body.memo || "").trim();

    if (!unitId || !isAdjustType(rawType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        propertyId: session.propertyId,
      },
      include: {
        tenantAssignments: {
          where: { isCurrent: true },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json(
        { ok: false, error: "Unit not found" },
        { status: 404 }
      );
    }

    const assignment = unit.tenantAssignments[0] ?? null;

    if (!assignment) {
      return NextResponse.json(
        { ok: false, error: "No current tenant assignment for this unit" },
        { status: 400 }
      );
    }

    // ============================
    // STANDARD ADJUSTMENTS
    // ============================
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid amount" },
        { status: 400 }
      );
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

    const currentEffectiveDate = new Date();
const currentBillingCycle = getCycleKey(currentEffectiveDate);

const blockingPayment = await prisma.payment.findFirst({
  where: {
    propertyId: session.propertyId,
    unitId: unit.id,
    tenantAssignmentId: assignment.id,
    billingCycle: currentBillingCycle,
    status: { in: ["PENDING", "PAID"] },
  },
  select: { id: true },
});

const finalBillingCycle = blockingPayment
  ? getNextCycleKey(currentBillingCycle)
  : currentBillingCycle;

const finalEffectiveDate = blockingPayment
  ? new Date(`${finalBillingCycle}-01T00:00:00`)
  : currentEffectiveDate;

await prisma.ledgerEntry.create({
  data: {
    propertyId: session.propertyId,
    unitId: unit.id,
    tenantAssignmentId: assignment.id,
    entryType,
    chargeType,
    amountCents,
    memo: blockingPayment
      ? `${memo || defaultMemo} (applies next billing cycle)`
      : memo || defaultMemo,
    effectiveDate: finalEffectiveDate,
    billingCycle: finalBillingCycle,
    createdByManagementUserId: session.managementUserId ?? null,
  },
});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to adjust balance" },
      { status: 500 }
    );
  }
}
