import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BillingCalendarError } from "@/lib/billingCalendar";
import { getBusinessDate, getBusinessDateInstant } from "@/lib/rentDates";
import { getUnitFinancialState } from "@/lib/unitFinancialState";
import { lockManualTenancy, lockManualRows, isManualRetryable, isManualLockContention } from "@/lib/manualFinancialOperations";

const MAX_ATTEMPTS = 3;
class LateFeeEvidenceError extends Error {}
class LateFeeStateChanged extends Error {}
type LateFeeJobFailure = { propertyId: string; unitId: string; unitNumber: string; error: string };
type LateFeesJobResult = {
  ok: true; billingCycle: "per-unit"; posted: number; skipped: number;
  failedUnits: number; failures: LateFeeJobFailure[];
};
type FeeScope = { propertyId: string; unitId: string; tenantAssignmentId: string; billingCycle: string };
type HistoricalFee = {
  id: string; propertyId: string; unitId: string; tenantAssignmentId: string | null;
  billingCycle: string | null; entryType: string; chargeType: string | null;
  idempotencyKey: string | null; effectiveDate: Date; amountCents: number; memo: string | null;
};

// These local components represent the Chicago calendar, not a UTC instant.
function businessDay(instant: Date): string {
  const date = getBusinessDate(instant);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}
function nextCalendarDay(label: string): string {
  // UTC is only an ordinal calendar cursor, never a ledger instant. Convert
  // each label separately through the existing Chicago authority for DST.
  const [year, month, day] = label.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day + 1));
  return [cursor.getUTCFullYear(), String(cursor.getUTCMonth() + 1).padStart(2, "0"),
    String(cursor.getUTCDate()).padStart(2, "0")].join("-");
}
function initialKey(scope: FeeScope): string {
  return `LATE_FEE_INITIAL:${scope.tenantAssignmentId}:${scope.billingCycle}`;
}
function dailyPrefix(scope: FeeScope): string {
  return `LATE_FEE_DAILY:${scope.tenantAssignmentId}:${scope.billingCycle}:`;
}
function assertScope(row: HistoricalFee, scope: FeeScope) {
  if (row.propertyId !== scope.propertyId || row.unitId !== scope.unitId ||
      row.tenantAssignmentId !== scope.tenantAssignmentId || row.billingCycle !== scope.billingCycle ||
      row.entryType !== "CHARGE") {
    throw new LateFeeEvidenceError("Late-fee identity has incompatible property/unit/assignment/cycle scope.");
  }
}
function historicalDailyDay(row: HistoricalFee): string {
  const date = businessDay(row.effectiveDate);
  if (getBusinessDateInstant(date).getTime() !== row.effectiveDate.getTime()) {
    throw new LateFeeEvidenceError("Historical daily fee does not establish an unambiguous Chicago date.");
  }
  const memoDate = /^Daily late fee - (\d{4}-\d{2}-\d{2})$/.exec(row.memo ?? "")?.[1];
  if (memoDate && memoDate !== date) {
    throw new LateFeeEvidenceError("Historical daily fee has contradictory date evidence.");
  }
  return date;
}
async function isProvenManual(tx: Prisma.TransactionClient, row: HistoricalFee): Promise<boolean> {
  const audits = await tx.auditLog.findMany({
    where: { targetId: row.id, action: "MANUAL_CHARGE_POSTED" },
    select: { propertyId: true, actorType: true, targetType: true, targetId: true, metadataJson: true },
  });
  if (audits.length !== 1) return false;
  const audit = audits[0];
  try {
    const metadata = JSON.parse(audit.metadataJson ?? "null");
    return audit.propertyId === row.propertyId && audit.targetId === row.id &&
      audit.targetType === "LEDGER_ENTRY" && ["OWNER", "MANAGER"].includes(audit.actorType) &&
      metadata?.unitId === row.unitId && metadata?.tenantAssignmentId === row.tenantAssignmentId &&
      metadata?.entryType === "CHARGE" && metadata?.chargeType === "LATE_FEE" &&
      metadata?.amountCents === row.amountCents && metadata?.effectiveDate === row.effectiveDate.toISOString();
  } catch { return false; }
}
async function consumedIdentities(tx: Prisma.TransactionClient, scope: FeeScope): Promise<Set<string>> {
  const initial = initialKey(scope);
  const prefix = dailyPrefix(scope);
  // Include waived rows and keys with incompatible scope. Neither may be
  // silently bypassed by a history lookup restricted to nonvoided charges.
  const rows = await tx.ledgerEntry.findMany({
    where: { OR: [
      { ...scope, entryType: "CHARGE", chargeType: { in: ["LATE_FEE", "LATE_FEE_INITIAL", "LATE_FEE_DAILY"] } },
      { idempotencyKey: initial },
      { idempotencyKey: { startsWith: prefix } },
    ] },
    select: { id: true, propertyId: true, unitId: true, tenantAssignmentId: true, billingCycle: true,
      entryType: true, chargeType: true, idempotencyKey: true, effectiveDate: true, amountCents: true, memo: true },
  });
  const consumed = new Set<string>();
  for (const row of rows) {
    assertScope(row, scope);
    if (row.chargeType === "LATE_FEE_DAILY") {
      const key = prefix + historicalDailyDay(row);
      if (row.idempotencyKey && row.idempotencyKey !== key) {
        throw new LateFeeEvidenceError("Daily fee key conflicts with historical date evidence.");
      }
      consumed.add(key);
    } else if (row.chargeType === "LATE_FEE_INITIAL") {
      if (row.idempotencyKey && row.idempotencyKey !== initial) {
        throw new LateFeeEvidenceError("Initial fee key conflicts with historical identity.");
      }
      consumed.add(initial);
    } else if (row.chargeType === "LATE_FEE") {
      const manual = await isProvenManual(tx, row);
      if (row.idempotencyKey === initial && !manual) {
        // A canonical automatic identity is affirmative automatic provenance.
        // Never infer unkeyed legacy origin from memo or creator fields.
        const manualEvidence = await tx.auditLog.count({ where: { targetId: row.id, action: "MANUAL_CHARGE_POSTED" } });
        if (manualEvidence) throw new LateFeeEvidenceError("Automatic key has contradictory manual provenance.");
        consumed.add(initial);
      } else if (!row.idempotencyKey && manual) {
        continue;
      } else {
        throw new LateFeeEvidenceError("Legacy late-fee provenance is missing, contradictory or ambiguous.");
      }
    } else {
      throw new LateFeeEvidenceError("Late-fee key is attached to an incompatible ledger type.");
    }
  }
  return consumed;
}
function eligible(state: Awaited<ReturnType<typeof getUnitFinancialState>>): boolean {
  return state.rentDates.hasStarted && state.effectiveBillingSettings.lateFeeEnabled &&
    state.isPastGracePeriod && state.ledgerBalanceCents > 0 && !state.hasPendingPayment && !state.hasPaidPayment;
}
function retryable(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return error instanceof LateFeeStateChanged || code === "P2002" ||
    isManualRetryable(error) || isManualLockContention(error);
}

export async function runLateFeesJob(asOf = new Date(), propertyId?: string): Promise<LateFeesJobResult> {
  const rawNow = asOf;
  const today = businessDay(rawNow);
  const units = await prisma.unit.findMany({
    where: { isActive: true, ...(propertyId ? { propertyId } : {}) },
    include: { property: { include: { settings: true } },
      tier: { select: { rentDueDay: true, gracePeriodDays: true, lateFeeInitialCents: true,
        lateFeeDailyCents: true, maxLateFeeDays: true } },
      tenantAssignments: { where: { isCurrent: true, moveOutDate: null },
        orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }], take: 1, select: { id: true } } },
  });
  let posted = 0;
  let skipped = 0;
  const failures: LateFeeJobFailure[] = [];
  for (const selected of units) {
    const assignment = selected.tenantAssignments[0];
    if (!assignment) { skipped++; continue; }
    try {
      const initialState = await getUnitFinancialState({ propertyId: selected.propertyId, unitId: selected.id,
        tenantAssignmentId: assignment.id, tier: selected.tier, propertySettings: selected.property.settings,
        rentFrayStartDate: selected.property.rentFrayStartDate, now: rawNow });
      if (!eligible(initialState)) { skipped++; continue; }
      const scope: FeeScope = { propertyId: selected.propertyId, unitId: selected.id,
        tenantAssignmentId: assignment.id, billingCycle: initialState.billingCycle };
      let count: number | undefined;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          count = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const provisional = await tx.unit.findFirst({ where: { id: scope.unitId, propertyId: scope.propertyId, isActive: true },
              select: { tierId: true } });
            if (!provisional) return 0;
            await lockManualTenancy(tx, scope.propertyId, scope.unitId, assignment.id, scope.billingCycle);
            await lockManualRows(tx, scope.propertyId, scope.unitId, assignment.id, provisional.tierId ? [provisional.tierId] : []);
            const currentAssignment = await tx.tenantAssignment.findFirst({ where: { id: assignment.id,
              propertyId: scope.propertyId, unitId: scope.unitId, isCurrent: true, moveOutDate: null }, select: { id: true } });
            if (!currentAssignment) return 0;
            const unit = await tx.unit.findFirst({ where: { id: scope.unitId, propertyId: scope.propertyId, isActive: true },
              include: { tier: true, property: { include: { settings: true } } } });
            if (!unit) return 0;
            if (unit.tierId !== provisional.tierId) throw new LateFeeStateChanged("Tier changed while locking late-fee state.");
            if (unit.tier && unit.tier.propertyId !== scope.propertyId) {
              throw new LateFeeEvidenceError("Tier does not belong to the selected property.");
            }
            // The unchanged financial SSOT reads committed state using its shared
            // client. Compatible payment locks and tenancy row locks remain held.
            const state = await getUnitFinancialState({ propertyId: scope.propertyId, unitId: scope.unitId,
              tenantAssignmentId: assignment.id, tier: unit.tier, propertySettings: unit.property.settings,
              rentFrayStartDate: unit.property.rentFrayStartDate, now: rawNow });
            if (state.billingCycle !== scope.billingCycle) {
              throw new LateFeeStateChanged("Billing cycle changed; the original fee cycle cannot be redirected.");
            }
            if (!eligible(state)) return 0;
            const consumed = await consumedIdentities(tx, scope);
            const effective = state.effectiveBillingSettings;
            const dates = state.rentDates;
            const entries: Prisma.LedgerEntryCreateManyInput[] = [];
            if (effective.lateFeeInitialCents > 0 && dates.initialLateFeeDate && today >= dates.initialLateFeeDate &&
                !consumed.has(initialKey(scope))) {
              entries.push({ ...scope, entryType: "CHARGE", chargeType: "LATE_FEE_INITIAL",
                amountCents: effective.lateFeeInitialCents, memo: `Initial late fee - ${scope.billingCycle}`,
                effectiveDate: getBusinessDateInstant(dates.initialLateFeeDate),
                idempotencyKey: initialKey(scope), createdByManagementUserId: null });
            }
            if (effective.lateFeeDailyCents > 0 && effective.maxLateFeeDays > 0 &&
                dates.dailyLateFeeStartDate && dates.dailyLateFeeLastDate) {
              let day = dates.dailyLateFeeStartDate;
              while (day <= today && day <= dates.dailyLateFeeLastDate) {
                const key = dailyPrefix(scope) + day;
                if (!consumed.has(key)) entries.push({ ...scope, entryType: "CHARGE", chargeType: "LATE_FEE_DAILY",
                  amountCents: effective.lateFeeDailyCents, memo: `Daily late fee - ${day}`,
                  effectiveDate: getBusinessDateInstant(day), idempotencyKey: key, createdByManagementUserId: null });
                day = nextCalendarDay(day);
              }
            }
            if (!entries.length) return 0;
            // No skipDuplicates: any unexpected conflict aborts the entire batch.
            const result = await tx.ledgerEntry.createMany({ data: entries });
            if (result.count !== entries.length) throw new LateFeeEvidenceError("Incomplete automatic fee batch.");
            return result.count;
          }, { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout: 20_000 });
          break;
        } catch (error) {
          if (retryable(error) && attempt + 1 < MAX_ATTEMPTS) continue;
          throw error;
        }
      }
      if (count === undefined) throw new Error("Late-fee transaction did not complete.");
      posted += count;
      if (!count) skipped++;
    } catch (error) {
      if (!(error instanceof BillingCalendarError) && !(error instanceof LateFeeEvidenceError) && !retryable(error)) throw error;
      const failure = { propertyId: selected.propertyId, unitId: selected.id, unitNumber: selected.unitNumber,
        error: error instanceof Error ? error.message : String(error) };
      failures.push(failure);
      console.error("[late-fees] Skipping unit after safe late-fee failure", failure);
    }
  }
  return { ok: true, billingCycle: "per-unit", posted, skipped, failedUnits: failures.length, failures };
}
