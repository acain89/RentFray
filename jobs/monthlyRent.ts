import { Prisma, type PrismaClient, type PropertyTierCharge } from "@prisma/client";
import {
  assertTierBillingCalendar,
  BillingCalendarError,
} from "@/lib/billingCalendar";
import { prisma } from "@/lib/prisma";
import {
  getBusinessDate,
  getDueBillingCyclesThrough,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";

const UNIT_CHUNK_SIZE = 500;
const LEDGER_CREATE_CHUNK_SIZE = 1000;
const MONTHLY_RENT_JOB_LOCK_ID = 91024001;

type MonthlyRentJobFailure = {
  propertyId: string;
  unitId: string;
  unitNumber: string;
  error: string;
};

type MonthlyRentJobResult = {
  ok: true;
  processedUnits: number;
  dueUnits: number;
  skippedNoTenant: number;
  skippedNotDue: number;
  skippedMoveInAfterDue: number;
  rentChargesCreated: number;
  recurringFeeChargesCreated: number;
  existingChargesSkipped: number;
  failedUnits: number;
  failures: MonthlyRentJobFailure[];
};

type MonthlyRentUnit = Prisma.UnitGetPayload<{
  include: {
    property: {
      include: {
        settings: true;
      };
    };
    tier: true;
    tenantAssignments: true;
    recurringFeeItems: true;
  };
}>;

type DueUnitPayload = {
  unit: MonthlyRentUnit;
  assignment: MonthlyRentUnit["tenantAssignments"][number];
  billingCycle: string;
  dueDate: Date;
};

function parseDateOnly(value: string): Date {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  return new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
}

function rentKey(unitId: string, billingCycle: string): string {
  return `${unitId}|${billingCycle}|RENT`;
}

function recurringMemoBucketKey(unitId: string, billingCycle: string): string {
  return `${unitId}|${billingCycle}|RECURRING_FEE`;
}

function rentIdempotencyKey(unitId: string, billingCycle: string): string {
  return `RENT:${unitId}:${billingCycle}`;
}

function unitRecurringFeeIdempotencyKey(
  unitId: string,
  billingCycle: string,
  recurringFeeId: string
): string {
  return `UNIT_RECURRING_FEE:${unitId}:${billingCycle}:${recurringFeeId}`;
}

function tierRecurringFeeIdempotencyKey(
  unitId: string,
  billingCycle: string,
  tierChargeId: string
): string {
  return `TIER_RECURRING_FEE:${unitId}:${billingCycle}:${tierChargeId}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasLegacyRecurringFee(
  recurringMemosByBucket: Map<string, Set<string>>,
  unitId: string,
  billingCycle: string,
  label: string
): boolean {
  const memos = recurringMemosByBucket.get(
    recurringMemoBucketKey(unitId, billingCycle)
  );

  if (!memos) return false;

  for (const memo of memos) {
    if (memo === label || memo.startsWith(`${label} - `)) {
      return true;
    }
  }

  return false;
}

async function acquireMonthlyRentLock(db: PrismaClient): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${MONTHLY_RENT_JOB_LOCK_ID}) AS locked
    `;

    return rows[0]?.locked === true;
  } catch {
    return true;
  }
}

async function releaseMonthlyRentLock(db: PrismaClient): Promise<void> {
  try {
    await db.$executeRaw`
      SELECT pg_advisory_unlock(${MONTHLY_RENT_JOB_LOCK_ID})
    `;
  } catch {
    // Local/non-Postgres fallback. No-op.
  }
}

async function createLedgerEntriesInChunks(
  rows: Prisma.LedgerEntryCreateManyInput[]
): Promise<number> {
  let created = 0;

  for (let i = 0; i < rows.length; i += LEDGER_CREATE_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + LEDGER_CREATE_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const result = await prisma.ledgerEntry.createMany({
      data: chunk,
      skipDuplicates: true,
    });

    created += result.count;
  }

  return created;
}

export async function runMonthlyRentJob(
  asOf = new Date(),
  propertyId?: string
): Promise<MonthlyRentJobResult> {
  const lockAcquired = await acquireMonthlyRentLock(prisma);

  if (!lockAcquired) {
    return {
      ok: true,
      processedUnits: 0,
      dueUnits: 0,
      skippedNoTenant: 0,
      skippedNotDue: 0,
      skippedMoveInAfterDue: 0,
      rentChargesCreated: 0,
      recurringFeeChargesCreated: 0,
      existingChargesSkipped: 0,
      failedUnits: 0,
      failures: [],
    };
  }

  let cursorId: string | undefined;
  let processedUnits = 0;
  let dueUnits = 0;
  let skippedNoTenant = 0;
  let skippedNotDue = 0;
  let skippedMoveInAfterDue = 0;
  let rentChargesCreated = 0;
  let recurringFeeChargesCreated = 0;
  let existingChargesSkipped = 0;
  const failures: MonthlyRentJobFailure[] = [];

  try {
    while (true) {
      const units: MonthlyRentUnit[] = await prisma.unit.findMany({
        where: {
          isActive: true,
          ...(propertyId ? { propertyId } : {}),
        },
        orderBy: { id: "asc" },
        take: UNIT_CHUNK_SIZE,
        ...(cursorId
          ? {
              cursor: { id: cursorId },
              skip: 1,
            }
          : {}),
        include: {
          property: {
            include: {
              settings: true,
            },
          },
          tier: true,
          tenantAssignments: {
            where: {
              isCurrent: true,
              moveOutDate: null,
            },
            orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
            take: 1,
          },
          recurringFeeItems: {
            where: {
              isActive: true,
            },
          },
        },
      });

      if (units.length === 0) break;

      cursorId = units[units.length - 1]?.id;
      processedUnits += units.length;

      const tierIds = Array.from(
        new Set(
          units
            .map((unit) => unit.tier?.id ?? null)
            .filter((tierId): tierId is string => Boolean(tierId))
        )
      );

      const tierCharges =
        tierIds.length > 0
          ? await prisma.propertyTierCharge.findMany({
              where: {
                tierId: { in: tierIds },
                isActive: true,
              },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            })
          : [];

      const tierChargesByTierId = new Map<string, PropertyTierCharge[]>();

      for (const charge of tierCharges) {
        const bucket = tierChargesByTierId.get(charge.tierId) ?? [];
        bucket.push(charge);
        tierChargesByTierId.set(charge.tierId, bucket);
      }

      const dueUnitPayloads: DueUnitPayload[] = [];

      for (const unit of units) {
        const assignment = unit.tenantAssignments[0] ?? null;

        if (!assignment) {
          skippedNoTenant++;
          continue;
        }

        try {
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

          effective.dueDay = permanentDueDay;

          if (!unit.property.rentFrayStartDate) {
            skippedNotDue++;
            continue;
          }

          const dueCycles = getDueBillingCyclesThrough({
            rentFrayStartDate: unit.property.rentFrayStartDate,
            dueDay: effective.dueDay,
            now: asOf,
          });

          if (dueCycles.length === 0) {
            skippedNotDue++;
            continue;
          }

          const assignmentStart = getBusinessDate(
            assignment.moveInDate ?? assignment.createdAt
          );

          let unitHasEligibleCycle = false;

          for (const cycle of dueCycles) {
            const dueDate = parseDateOnly(cycle.dueDate);

            if (assignmentStart.getTime() > dueDate.getTime()) {
              skippedMoveInAfterDue++;
              continue;
            }

            unitHasEligibleCycle = true;
            dueUnits++;

            dueUnitPayloads.push({
              unit,
              assignment,
              billingCycle: cycle.billingCycle,
              dueDate,
            });
          }

          if (!unitHasEligibleCycle) {
            skippedNotDue++;
          }
        } catch (error: unknown) {
          if (!(error instanceof BillingCalendarError)) {
            throw error;
          }

          const failure: MonthlyRentJobFailure = {
            propertyId: unit.propertyId,
            unitId: unit.id,
            unitNumber: unit.unitNumber,
            error: getErrorMessage(error),
          };

          failures.push(failure);

          console.error(
            "[monthly-rent] Skipping unit with invalid billing calendar",
            {
              ...failure,
            }
          );
        }
      }

      if (dueUnitPayloads.length === 0) continue;

      const dueUnitIds = dueUnitPayloads.map((item) => item.unit.id);

      const billingCycles = Array.from(
        new Set(dueUnitPayloads.map((item) => item.billingCycle))
      );

      const existingEntries = await prisma.ledgerEntry.findMany({
        where: {
          unitId: { in: dueUnitIds },
          billingCycle: { in: billingCycles },
          entryType: "CHARGE",
          chargeType: { in: ["RENT", "RECURRING_FEE"] },
          voidedAt: null,
        },
        select: {
          unitId: true,
          billingCycle: true,
          chargeType: true,
          memo: true,
          idempotencyKey: true,
        },
      });

      const existingRentKeys = new Set<string>();
      const existingIdempotencyKeys = new Set<string>();
      const recurringMemosByBucket = new Map<string, Set<string>>();

      for (const entry of existingEntries) {
        if (entry.idempotencyKey) {
          existingIdempotencyKeys.add(entry.idempotencyKey);
        }

        if (!entry.billingCycle) continue;

        const chargeType = String(entry.chargeType);

        if (chargeType === "RENT") {
          existingRentKeys.add(rentKey(entry.unitId, entry.billingCycle));
          continue;
        }

        if (chargeType === "RECURRING_FEE") {
          const bucketKey = recurringMemoBucketKey(
            entry.unitId,
            entry.billingCycle
          );
          const bucket = recurringMemosByBucket.get(bucketKey) ?? new Set<string>();
          bucket.add(entry.memo ?? "");
          recurringMemosByBucket.set(bucketKey, bucket);
        }
      }

      const rentRows: Prisma.LedgerEntryCreateManyInput[] = [];
      const recurringFeeRows: Prisma.LedgerEntryCreateManyInput[] = [];

      for (const item of dueUnitPayloads) {
        const { unit, assignment, billingCycle, dueDate } = item;

        const baseRentCents = Math.max(0, unit.tier?.baseRentCents ?? 0);

        if (baseRentCents > 0) {
          const legacyKey = rentKey(unit.id, billingCycle);
          const idempotencyKey = rentIdempotencyKey(unit.id, billingCycle);

          if (
            existingRentKeys.has(legacyKey) ||
            existingIdempotencyKeys.has(idempotencyKey)
          ) {
            existingChargesSkipped++;
          } else {
            existingRentKeys.add(legacyKey);
            existingIdempotencyKeys.add(idempotencyKey);

            rentRows.push({
              propertyId: unit.propertyId,
              unitId: unit.id,
              tenantAssignmentId: assignment.id,
              entryType: "CHARGE",
              chargeType: "RENT",
              amountCents: baseRentCents,
              billingCycle,
              effectiveDate: dueDate,
              memo: "Monthly Rent",
              idempotencyKey,
            });
          }
        }

        for (const fee of unit.recurringFeeItems) {
          const amountCents = Math.max(0, fee.amountCents);
          if (amountCents <= 0) continue;

          const feeStartDate = getBusinessDate(fee.createdAt);
          if (feeStartDate.getTime() > dueDate.getTime()) continue;

          const memo = fee.label;
          const idempotencyKey = unitRecurringFeeIdempotencyKey(
            unit.id,
            billingCycle,
            fee.id
          );

          if (
            existingIdempotencyKeys.has(idempotencyKey) ||
            hasLegacyRecurringFee(
              recurringMemosByBucket,
              unit.id,
              billingCycle,
              memo
            )
          ) {
            existingChargesSkipped++;
            continue;
          }

          existingIdempotencyKeys.add(idempotencyKey);

          recurringFeeRows.push({
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "RECURRING_FEE",
            amountCents,
            billingCycle,
            effectiveDate: dueDate,
            memo,
            idempotencyKey,
          });
        }

        const tierId = unit.tier?.id ?? null;
        const applicableTierCharges = tierId
          ? tierChargesByTierId.get(tierId) ?? []
          : [];

        for (const charge of applicableTierCharges) {
          const amountCents = Math.max(0, charge.amountCents);
          if (amountCents <= 0) continue;

          const chargeStartDate = getBusinessDate(charge.effectiveDate);
          if (chargeStartDate.getTime() > dueDate.getTime()) continue;

          const idempotencyKey = tierRecurringFeeIdempotencyKey(
            unit.id,
            billingCycle,
            charge.id
          );

          if (existingIdempotencyKeys.has(idempotencyKey)) {
            existingChargesSkipped++;
            continue;
          }

          existingIdempotencyKeys.add(idempotencyKey);

          recurringFeeRows.push({
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "RECURRING_FEE",
            amountCents,
            billingCycle,
            effectiveDate: dueDate,
            memo: charge.label,
            idempotencyKey,
          });
        }
      }

      rentChargesCreated += await createLedgerEntriesInChunks(rentRows);
      recurringFeeChargesCreated += await createLedgerEntriesInChunks(
        recurringFeeRows
      );
    }

    return {
      ok: true,
      processedUnits,
      dueUnits,
      skippedNoTenant,
      skippedNotDue,
      skippedMoveInAfterDue,
      rentChargesCreated,
      recurringFeeChargesCreated,
      existingChargesSkipped,
      failedUnits: failures.length,
      failures,
    };
  } finally {
    await releaseMonthlyRentLock(prisma);
  }
}
