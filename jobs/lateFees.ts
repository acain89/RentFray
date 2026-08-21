import { prisma } from "@/lib/prisma";
import { BillingCalendarError } from "@/lib/billingCalendar";
import { getBusinessDate } from "@/lib/rentDates";
import { getUnitFinancialState } from "@/lib/unitFinancialState";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoDay(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isOnOrAfter(date: Date, comparisonDate: Date): boolean {
  return startOfDay(date).getTime() >= startOfDay(comparisonDate).getTime();
}

function isOnOrBefore(date: Date, comparisonDate: Date): boolean {
  return startOfDay(date).getTime() <= startOfDay(comparisonDate).getTime();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type LateFeeJobFailure = {
  propertyId: string;
  unitId: string;
  unitNumber: string;
  error: string;
};

type LateFeesJobResult = {
  ok: true;
  billingCycle: "per-unit";
  posted: number;
  skipped: number;
  failedUnits: number;
  failures: LateFeeJobFailure[];
};

export async function runLateFeesJob(
  asOf = new Date(),
  propertyId?: string
): Promise<LateFeesJobResult> {
  // Preserve the original timestamp for timezone-aware financial calculations.
  const rawNow = asOf;

  // Normalize only the effective ledger date/memo date to RentFray business time.
  const effectiveDate = getBusinessDate(rawNow);

  const units = await prisma.unit.findMany({
    where: {
      isActive: true,
      ...(propertyId ? { propertyId } : {}),
    },
    include: {
      property: {
        include: {
          settings: true,
        },
      },
      tier: {
        select: {
          rentDueDay: true,
          gracePeriodDays: true,
          lateFeeInitialCents: true,
          lateFeeDailyCents: true,
          maxLateFeeDays: true,
        },
      },
      tenantAssignments: {
        where: {
          isCurrent: true,
          moveOutDate: null,
        },
        orderBy: [
          {
            moveInDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 1,
        select: {
          id: true,
        },
      },
    },
  });

  let posted = 0;
  let skipped = 0;
  const failures: LateFeeJobFailure[] = [];

  for (const unit of units) {
    const assignment = unit.tenantAssignments[0] ?? null;

    if (!assignment) {
      skipped++;
      continue;
    }

    let financialState: Awaited<ReturnType<typeof getUnitFinancialState>>;

    try {
      financialState = await getUnitFinancialState({
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantAssignmentId: assignment.id,
        tier: unit.tier,
        propertySettings: unit.property.settings,
        rentFrayStartDate: unit.property.rentFrayStartDate,
        now: rawNow,
      });
    } catch (error: unknown) {
      if (!(error instanceof BillingCalendarError)) {
        throw error;
      }

      const failure: LateFeeJobFailure = {
        propertyId: unit.propertyId,
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        error: getErrorMessage(error),
      };

      failures.push(failure);

      console.error("[late-fees] Skipping unit with invalid billing calendar", {
        ...failure,
      });

      continue;
    }

    if (!financialState.rentDates.hasStarted) {
      skipped++;
      continue;
    }

    const effective = financialState.effectiveBillingSettings;
    const billingCycle = financialState.billingCycle;

    if (
      !effective.lateFeeEnabled ||
      !financialState.isPastGracePeriod ||
      financialState.ledgerBalanceCents <= 0 ||
      financialState.hasPendingPayment ||
      financialState.hasPaidPayment
    ) {
      skipped++;
      continue;
    }

    const initialLateFeeDate = parseDateOnly(
      financialState.rentDates.initialLateFeeDate
    );

    const dailyLateFeeStartDate = parseDateOnly(
      financialState.rentDates.dailyLateFeeStartDate
    );

    const dailyLateFeeLastDate = parseDateOnly(
      financialState.rentDates.dailyLateFeeLastDate
    );

    const existingLateFees: Array<{
      chargeType: string | null;
      memo: string | null;
    }> = await prisma.ledgerEntry.findMany({
      where: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantAssignmentId: assignment.id,
        billingCycle,
        entryType: "CHARGE",
        chargeType: {
          in: ["LATE_FEE", "LATE_FEE_INITIAL", "LATE_FEE_DAILY"],
        },
        voidedAt: null,
      },
      select: {
        chargeType: true,
        memo: true,
      },
    });

    const hasExistingInitial = existingLateFees.some(
      (entry) =>
        entry.chargeType === "LATE_FEE" ||
        entry.chargeType === "LATE_FEE_INITIAL"
    );

    const existingDailyMemos = new Set(
      existingLateFees
        .filter((entry) => entry.chargeType === "LATE_FEE_DAILY")
        .map((entry) => entry.memo)
        .filter((memo): memo is string => Boolean(memo))
    );

    const entriesToCreate: Array<{
      propertyId: string;
      unitId: string;
      tenantAssignmentId: string;
      entryType: string;
      chargeType: string;
      amountCents: number;
      memo: string;
      effectiveDate: Date;
      billingCycle: string;
      createdByManagementUserId: null;
    }> = [];

    if (
      effective.lateFeeInitialCents > 0 &&
      initialLateFeeDate &&
      isOnOrAfter(effectiveDate, initialLateFeeDate) &&
      !hasExistingInitial
    ) {
      entriesToCreate.push({
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantAssignmentId: assignment.id,
        entryType: "CHARGE",
        chargeType: "LATE_FEE_INITIAL",
        amountCents: effective.lateFeeInitialCents,
        memo: `Initial late fee - ${billingCycle}`,
        effectiveDate: initialLateFeeDate,
        billingCycle,
        createdByManagementUserId: null,
      });
    }

    if (
      effective.lateFeeDailyCents > 0 &&
      effective.maxLateFeeDays > 0 &&
      dailyLateFeeStartDate &&
      dailyLateFeeLastDate
    ) {
      let feeDate = dailyLateFeeStartDate;

      while (
        isOnOrBefore(feeDate, effectiveDate) &&
        isOnOrBefore(feeDate, dailyLateFeeLastDate)
      ) {
        const feeDay = isoDay(feeDate);
        const memo = `Daily late fee - ${feeDay}`;

        if (!existingDailyMemos.has(memo)) {
          entriesToCreate.push({
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "LATE_FEE_DAILY",
            amountCents: effective.lateFeeDailyCents,
            memo,
            effectiveDate: feeDate,
            billingCycle,
            createdByManagementUserId: null,
          });

          existingDailyMemos.add(memo);
        }

        feeDate = addDays(feeDate, 1);
      }
    }

    if (entriesToCreate.length === 0) {
      skipped++;
      continue;
    }

    const result = await prisma.ledgerEntry.createMany({
      data: entriesToCreate,
    });

    posted += result.count;
  }

  return {
    ok: true,
    billingCycle: "per-unit",
    posted,
    skipped,
    failedUnits: failures.length,
    failures,
  };
}