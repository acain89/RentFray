// app/api/manual-payments/route.ts

import { NextResponse } from "next/server";
import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";
import { emitEvent } from "@/lib/realtime";
import { ManualOperationError, normalizeOperationId, lockManualOperation, lockManualTenancy,
  lockManualRows, replayManualPayment, isManualRetryable, isManualLockContention } from "@/lib/manualFinancialOperations";
import {
  getRentDateSummary,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";
import { assertTierBillingCalendar } from "@/lib/billingCalendar";

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

type ManualPaymentEntryResponse = {
  id: string;
  propertyId: string;
  unitId: string;
  tenantAssignmentId: string | null;
  entryType: "PAYMENT";
  amountCents: number;
  memo: string | null;
  effectiveDate: Date;
  createdAt: Date;
  paymentId: string;
  status: PaymentStatus;
  billingCycle: string;
};

type ParsedBody = {
  unitId: string;
  tenantAssignmentId: string;
  operationId: string;
  amountCents: number;
  memo: string | null;
  effectiveDate: Date;
};

type UnitForManualPayment = {
  id: string;
  propertyId: string;
  unitNumber: string;
  tier: {
    rentDueDay: number;
    gracePeriodDays: number;
    lateFeeInitialCents: number;
    lateFeeDailyCents: number;
    maxLateFeeDays: number;
  } | null;
  property: {
    rentFrayStartDate: Date | null;
    settings: {
      rentDueDay: number;
      gracePeriodDays: number;
      lateFeeEnabled: boolean;
      lateFeeFlatCents: number | null;
    } | null;
  };
};

const MAX_PAYMENT_CENTS = 100_000_000;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeMemo(value: unknown): string | null {
  const trimmed = clean(value);
  return trimmed ? trimmed : null;
}

function parseMoneyToCents(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const cents = Math.round(n * 100);
  if (cents <= 0 || cents > MAX_PAYMENT_CENTS) return null;

  return cents;
}

function parseEffectiveDate(value: unknown): Date | null {
  const raw = clean(value);
  if (!raw) return null;

  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function badRequest(error: string) {
  return NextResponse.json<ApiError>({ ok: false, error }, { status: 400 });
}

async function parseBody(req: Request): Promise<ParsedBody | null> {
  const body = (await req.json()) as Record<string, unknown>;

  const unitId = clean(body.unitId);
  const tenantAssignmentId = clean(body.tenantAssignmentId);
  const operationId = normalizeOperationId(body.operationId);
  const amountCents = parseMoneyToCents(body.amount);
  const memo = normalizeMemo(body.memo ?? body.description);
  const effectiveDate = parseEffectiveDate(body.effectiveDate);

  if (!unitId || !tenantAssignmentId) return null;
  if (amountCents === null) return null;
  if (!effectiveDate) return null;

  return {
    unitId,
    tenantAssignmentId,
    operationId,
    amountCents,
    memo,
    effectiveDate,
  };
}

export async function GET() {
  return NextResponse.json<ApiSuccess<{ route: string }>>({
    ok: true,
    data: { route: "manual-payments" },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json<ApiError>({ ok: false, error: "Only owner or manager can post manual payments." }, { status: 401 });
    }
    let parsed: ParsedBody | null;
    try { parsed = await parseBody(req); }
    catch { return badRequest("Invalid request body."); }
    if (!parsed) return badRequest("Missing or invalid required fields.");
    const { unitId, tenantAssignmentId, operationId, amountCents, memo, effectiveDate } = parsed;
    const propertyId = session.propertyId;
    const payload = { unitId, tenantAssignmentId, amountCents, effectiveDate: effectiveDate.toISOString(), memo };
    const key = `MANUAL_PAYMENT:${propertyId}:${operationId}`;
    let completed: { entry: ManualPaymentEntryResponse; replayed: boolean } | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        completed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await lockManualOperation(tx, "MANUAL_PAYMENT", propertyId, operationId);
          const replay = await replayManualPayment<ManualPaymentEntryResponse>(tx, propertyId, key, payload);
          if (replay) return { entry: replay, replayed: true };
          const provisional = await tx.unit.findFirst({ where: { id: unitId, propertyId }, include: { tier: true, property: { include: { settings: true } } } });
          if (!provisional) throw new ManualOperationError("Unit not found.", 404);
          const cycleFor = (unit: NonNullable<typeof provisional>) => {
            const dueDay = assertTierBillingCalendar({ propertyId, rentFrayStartDate: unit.property.rentFrayStartDate,
              propertySettingsDueDay: unit.property.settings?.rentDueDay, tier: unit.tier });
            return getRentDateSummary({ ...resolveEffectiveBillingSettings({ tier: unit.tier, propertySettings: unit.property.settings }),
              dueDay, now: effectiveDate, rentFrayStartDate: unit.property.rentFrayStartDate }).billingCycle;
          };
          const provisionalCycle = cycleFor(provisional);
          await lockManualTenancy(tx, propertyId, unitId, tenantAssignmentId, provisionalCycle);
          await lockManualRows(tx, propertyId, unitId, tenantAssignmentId, provisional.tierId ? [provisional.tierId] : []);
          const unit = await tx.unit.findFirst({ where: { id: unitId, propertyId }, include: { tier: true, property: { include: { settings: true } } } });
          if (!unit) throw new ManualOperationError("Unit not found.", 404);
          const billingCycle = cycleFor(unit);
          if (billingCycle !== provisionalCycle || unit.tierId !== provisional.tierId) throw new ManualOperationError("Unit billing state changed. Retry the same operation.");
          const now = new Date();
          const assignment = await tx.tenantAssignment.findFirst({ where: {
            id: tenantAssignmentId, propertyId, unitId, isCurrent: true,
            AND: [{ OR: [{ moveOutDate: null }, { moveOutDate: { gt: now } }] },
              { OR: [{ moveInDate: null }, { moveInDate: { lte: now } }] }],
          }, select: { id: true } });
          if (!assignment) throw new ManualOperationError("The specified tenant assignment is no longer eligible for this unit.");
          const payment = await tx.payment.create({ data: {
            propertyId, unitId, tenantAssignmentId, amountCents, status: PaymentStatus.PAID,
            paidAt: effectiveDate, paymentMethod: "MANUAL", billingCycle,
            stripePaymentIntentId: `manual_${unitId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          }, select: { id: true, status: true, paidAt: true } });
          const entry = await tx.ledgerEntry.create({ data: {
            propertyId, unitId, tenantAssignmentId, entryType: "PAYMENT", amountCents: -amountCents,
            effectiveDate, billingCycle, memo, paymentId: payment.id, idempotencyKey: key,
            createdByManagementUserId: session.managementUserId ?? null,
          }, select: { id: true, propertyId: true, unitId: true, tenantAssignmentId: true, entryType: true,
            amountCents: true, effectiveDate: true, memo: true, createdAt: true, billingCycle: true } });
          const result: ManualPaymentEntryResponse = { id: entry.id, propertyId: entry.propertyId, unitId: entry.unitId,
            tenantAssignmentId: entry.tenantAssignmentId, entryType: "PAYMENT", amountCents: Math.abs(entry.amountCents),
            memo: entry.memo, effectiveDate: entry.effectiveDate, createdAt: entry.createdAt, paymentId: payment.id,
            status: payment.status, billingCycle };
          await tx.auditLog.create({ data: {
            propertyId, actorType: "MANAGER", actorManagementUserId: session.managementUserId ?? null,
            action: "MANUAL_PAYMENT_POSTED", targetType: "LEDGER_ENTRY", targetId: entry.id,
            summary: `Manual payment posted for unit ${unit.unitNumber}`,
            metadataJson: JSON.stringify({ unitId, unitNumber: unit.unitNumber, tenantAssignmentId, paymentId: payment.id,
              amountCents, billingCycle, memo, effectiveDate: effectiveDate.toISOString(), operation: { id: operationId, payload, result } }),
          } });
          return { entry: result, replayed: false };
        }, { isolationLevel: "ReadCommitted" });
        break;
      } catch (error) {
        if (isManualRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    if (!completed) throw new Error("Payment transaction did not complete.");
    if (!completed.replayed) {
      const event = { propertyId, unitId, tenantAssignmentId: completed.entry.tenantAssignmentId,
        entryId: completed.entry.id, entryType: completed.entry.entryType, source: "MANUAL_PAYMENT" };
      emitEvent("payment:update", event); emitEvent("ledger:update", event);
    }
    return NextResponse.json<ApiSuccess<{ entry: ManualPaymentEntryResponse }>>({ ok: true, data: { entry: completed.entry } });
  } catch (error) {
    if (error instanceof ManualOperationError) return NextResponse.json<ApiError>({ ok: false, error: error.message }, { status: error.status });
    if (isManualLockContention(error) || isManualRetryable(error)) return NextResponse.json<ApiError>({ ok: false, error: "Financial state is busy. Retry the same operation." }, { status: 409 });
    console.error("POST /api/manual-payments error:", error);
    return NextResponse.json<ApiError>({ ok: false, error: "Failed to post manual payment." }, { status: 500 });
  }
}
