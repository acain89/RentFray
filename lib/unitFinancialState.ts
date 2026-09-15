// lib/unitFinancialState.ts

import { getProcessingFeeCents } from "@/lib/billingConfig";
import {
  getUnitLedgerSummary,
  type LedgerSummary,
} from "@/lib/ledger";
import {
  getBusinessDate,
  getRentDateSummary,
  resolveEffectiveBillingSettings,
  type EffectiveBillingSettings,
  type RentDateSummary,
} from "@/lib/rentDates";
import {
  getUnitStatus,
  type PaymentStatus,
  type UnitStatusResult,
} from "@/lib/unitStatusEngine";
import {
  assertTierBillingCalendar,
} from "@/lib/billingCalendar";

type UnitFinancialStateTier = {
  id?: string | null;
  rentDueDay: number;
  gracePeriodDays: number;
  lateFeeInitialCents: number;
  lateFeeDailyCents: number;
  maxLateFeeDays: number;
} | null;

type UnitFinancialStatePropertySettings = {
  rentDueDay: number;
  gracePeriodDays: number;
  lateFeeEnabled: boolean;
  lateFeeFlatCents?: number | null;
} | null;

type UnitFinancialStateInput = {
  propertyId: string;
  unitId: string;
  tenantAssignmentId: string | null;
  tier: UnitFinancialStateTier;
  propertySettings: UnitFinancialStatePropertySettings;
  rentFrayStartDate?: Date | null;
  now?: Date;
};

function parseDateOnly(
  value: string
): Date | null {
  const [
    yearRaw,
    monthRaw,
    dayRaw,
  ] = value.split("-");

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(
    year,
    month - 1,
    day
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function startOfDay(
  date: Date
): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function diffDays(
  later: Date,
  earlier: Date
): number {
  const msPerDay =
    1000 * 60 * 60 * 24;

  return Math.max(
    0,
    Math.floor(
      (
        startOfDay(later).getTime() -
        startOfDay(earlier).getTime()
      ) / msPerDay
    )
  );
}

export type UnitFinancialState = {
  effectiveBillingSettings:
    EffectiveBillingSettings;

  rentDates: RentDateSummary;
  ledgerSummary: LedgerSummary;

  ledgerBalanceCents: number;
  processingFeeCents: number;
  tenantTotalDueCents: number;

  billingCycle: string;
  dueDate: string;
  graceEndsOn: string;

  isWithinGracePeriod: boolean;
  isPastGracePeriod: boolean;
  isDelinquent: boolean;

  daysPastDue: number;
  daysPastGrace: number;

  hasPendingPayment: boolean;
  hasFailedPayment: boolean;
  hasReversedPayment: boolean;
  hasPaidPayment: boolean;

  status: UnitStatusResult;
  paymentStatus: PaymentStatus;
};

export async function getUnitFinancialState(
  input: UnitFinancialStateInput
): Promise<UnitFinancialState> {
  /*
   * Keep the original timestamp for rentDates.
   *
   * rentDates.ts is the authority responsible for converting
   * an instant into the RentFray business date.
   */
  const rawNow =
    input.now ?? new Date();

  /*
   * This normalized business date is used only for direct
   * business-day comparisons inside this financial-state layer.
   */
  const now =
    getBusinessDate(rawNow);

  const permanentDueDay =
    assertTierBillingCalendar({
      propertyId:
        input.propertyId,

      rentFrayStartDate:
        input.rentFrayStartDate ?? null,

      propertySettingsDueDay:
        input.propertySettings?.rentDueDay,

      tier:
        input.tier,
    });

  const effectiveBillingSettings =
    resolveEffectiveBillingSettings({
      tier:
        input.tier,

      propertySettings:
        input.propertySettings,
    });

  effectiveBillingSettings.dueDay =
    permanentDueDay;

  const rentDates =
    getRentDateSummary({
      ...effectiveBillingSettings,

      /*
       * IMPORTANT:
       * Pass the raw instant.
       * Do not pass the already-normalized `now`.
       */
      now:
        rawNow,

      rentFrayStartDate:
        input.rentFrayStartDate ?? null,
    });

  const ledgerSummary =
    await getUnitLedgerSummary({
      unitId:
        input.unitId,

      tenantAssignmentId:
        input.tenantAssignmentId ??
        undefined,

      asOf:
        rawNow,

      billingCycle:
        rentDates.billingCycle,
    });

  const rawLedgerBalanceCents =
    Math.max(
      0,
      ledgerSummary.balanceCents
    );

  const hasPendingPayment =
    ledgerSummary.hasPendingPayment;

  const hasFailedPayment =
    ledgerSummary.hasFailedPayment;

  const hasReversedPayment =
    ledgerSummary.hasReversedPayment;

  const hasPaidPayment =
    ledgerSummary.hasPaidPayment;

  /*
   * A current-cycle pending payment temporarily suppresses
   * the payable balance/status while ACH is processing.
   */
  const effectiveBalanceCents =
    hasPendingPayment
      ? 0
      : rawLedgerBalanceCents;

  const processingFeeCents =
    effectiveBalanceCents > 0
      ? getProcessingFeeCents(
          effectiveBalanceCents
        )
      : 0;

  const tenantTotalDueCents =
    effectiveBalanceCents > 0
      ? effectiveBalanceCents +
        processingFeeCents
      : 0;

  const dueDate =
    parseDateOnly(
      rentDates.dueDate
    );

  const graceEndsOn =
    parseDateOnly(
      rentDates.graceEndsOn
    );

  /*
   * Prior-cycle debt remains delinquent across a cycle rollover.
   *
   * A new cycle's grace period must never make an older unpaid
   * obligation appear current again.
   */
  const hasPriorCycleDebt =
    ledgerSummary
      .priorCycleOutstandingCents > 0;

  const isPastGracePeriod =
    !hasPendingPayment &&
    effectiveBalanceCents > 0 &&
    (
      hasPriorCycleDebt ||
      rentDates.isDelinquent === true
    );

  const isWithinGracePeriod =
    !hasPendingPayment &&
    effectiveBalanceCents > 0 &&
    !isPastGracePeriod;

  /*
   * Aging:
   *
   * If FIFO ledger math proves that an older obligation is still
   * outstanding, age the delinquency from the effective date of
   * the oldest surviving obligation.
   *
   * Otherwise this is a current-cycle delinquency, so age it from
   * the current cycle's authoritative due date.
   */
  const delinquencyDueDate =
    hasPriorCycleDebt &&
    ledgerSummary.oldestOutstandingDueDate
      ? getBusinessDate(
          ledgerSummary
            .oldestOutstandingDueDate
        )
      : dueDate;

  const daysPastDue =
    isPastGracePeriod &&
    delinquencyDueDate
      ? diffDays(
          now,
          delinquencyDueDate
        )
      : 0;

  /*
   * daysPastGrace remains based on the current authoritative
   * rent-calendar grace boundary. It is separate from the
   * historical "days past due" aging displayed by the dashboard.
   */
  const daysPastGrace =
    isPastGracePeriod &&
    graceEndsOn
      ? diffDays(
          now,
          graceEndsOn
        )
      : 0;

  const status =
    getUnitStatus({
      balanceCents:
        effectiveBalanceCents,

      hasPendingPayment,
      hasFailedPayment,
      hasReversedPayment,

      isDelinquent:
        isPastGracePeriod,

      isWithinGracePeriod,
    });

  return {
    effectiveBillingSettings,
    rentDates,
    ledgerSummary,

    ledgerBalanceCents:
      rawLedgerBalanceCents,

    processingFeeCents,
    tenantTotalDueCents,

    billingCycle:
      rentDates.billingCycle,

    dueDate:
      rentDates.dueDate,

    graceEndsOn:
      rentDates.graceEndsOn,

    isWithinGracePeriod,
    isPastGracePeriod,

    isDelinquent:
      isPastGracePeriod,

    daysPastDue,
    daysPastGrace,

    hasPendingPayment,
    hasFailedPayment,
    hasReversedPayment,
    hasPaidPayment,

    status,

    paymentStatus:
      status.paymentStatus,
  };
}