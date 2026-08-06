// lib/rentDates.ts



type NullableDate = Date | null;

export type RentDateConfig = {
  dueDay: number;
  gracePeriodDays: number;
  lateFeeEnabled: boolean;
  lateFeeInitialCents: number;
  lateFeeDailyCents: number;
  maxLateFeeDays: number;
  now?: Date;

  /**
   * Canonical property start date.
   * This is the first scheduled rent due date RentFray recognizes.
   */
  rentFrayStartDate?: Date | null;
};

export type RentDateSummary = {
  hasStarted: boolean;
  billingCycle: string;
  dueDate: string;
  nextDueDate: string;
  graceEndsOn: string;
  initialLateFeeDate: string | null;
  dailyLateFeeStartDate: string | null;
  dailyLateFeeLastDate: string | null;
  isDelinquent: boolean;
};

export type EffectiveBillingSettings = {
  dueDay: number;
  gracePeriodDays: number;
  lateFeeEnabled: boolean;
  lateFeeInitialCents: number;
  lateFeeDailyCents: number;
  maxLateFeeDays: number;
};

const BUSINESS_TIME_ZONE = "America/Chicago";

type CalendarParts = {
  year: number;
  month: number;
  day: number;
};

export function getBusinessDate(now: Date = new Date()): Date {
  const { year, month, day } = getBusinessDateParts(now);
  return createDateOnly(year, month, day);
}

export function formatRentFrayDate(
  value: Date | string | null | undefined
): string {
  if (!value) return "—";

  const date =
    value instanceof Date
      ? getBusinessDate(value)
      : parseDateOnly(String(value));

  if (!date) return "—";

  return [
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getFullYear()),
  ].join("/");
}

export function parseRentFrayDate(
  value: string | Date | null | undefined
): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return getBusinessDate(value);
  }

  return parseDateOnly(value);
}

export function resolveEffectiveBillingSettings(input: {
  tier?: {
    rentDueDay: number;
    gracePeriodDays: number;
    lateFeeInitialCents: number;
    lateFeeDailyCents: number;
    maxLateFeeDays: number;
  } | null;
  propertySettings?: {
    rentDueDay: number;
    gracePeriodDays: number;
    lateFeeEnabled: boolean;
    lateFeeFlatCents?: number | null;
  } | null;
}): EffectiveBillingSettings {
  const tier = input.tier;
  const propertySettings = input.propertySettings;

  if (tier) {
    return {
      dueDay: clampDueDay(tier.rentDueDay),
      gracePeriodDays: sanitizeNonNegativeInt(
        tier.gracePeriodDays,
        0
      ),
      lateFeeEnabled:
        tier.lateFeeInitialCents > 0 ||
        tier.lateFeeDailyCents > 0,
      lateFeeInitialCents: sanitizeNonNegativeInt(
        tier.lateFeeInitialCents,
        0
      ),
      lateFeeDailyCents: sanitizeNonNegativeInt(
        tier.lateFeeDailyCents,
        0
      ),
      maxLateFeeDays: sanitizeNonNegativeInt(
        tier.maxLateFeeDays,
        0
      ),
    };
  }

  return {
    dueDay: clampDueDay(propertySettings?.rentDueDay ?? 1),
    gracePeriodDays: sanitizeNonNegativeInt(
      propertySettings?.gracePeriodDays ?? 0,
      0
    ),
    lateFeeEnabled: Boolean(propertySettings?.lateFeeEnabled),
    lateFeeInitialCents: sanitizeNonNegativeInt(
      propertySettings?.lateFeeFlatCents ?? 0,
      0
    ),
    lateFeeDailyCents: 0,
    maxLateFeeDays: 0,
  };
}

/**
 * Sole authority for RentFray recurring financial dates.
 *
 * rentFrayStartDate:
 * - is the first scheduled rent due date RentFray recognizes;
 * - must match the property's configured due day;
 * - permanently excludes every earlier cycle.
 */
export function getRentDateSummary(
  config: RentDateConfig
): RentDateSummary {
  const rawNow = config.now ?? new Date();
  const today = getBusinessDate(rawNow);

  const dueDay = clampDueDay(config.dueDay);
  const gracePeriodDays = sanitizeNonNegativeInt(
    config.gracePeriodDays,
    0
  );

const configuredStart =
  config.rentFrayStartDate ?? null;

  const startDate = configuredStart
  ? createDateOnly(
      configuredStart.getUTCFullYear(),
      configuredStart.getUTCMonth() + 1,
      configuredStart.getUTCDate()
    )
  : null;

  if (startDate && startDate.getDate() !== clampDay(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    dueDay
  )) {
throw new Error(
  [
    "rentFrayStartDate must match the configured property due day.",
    `start=${toDateOnlyString(startDate)}`,
    `startDay=${startDate.getDate()}`,
    `dueDay=${dueDay}`,
    `expectedDay=${clampDay(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      dueDay
    )}`,
  ].join(" ")
);
  }

  const hasStarted = startDate === null || today >= startDate;

  let dueDate: Date;

  if (startDate && !hasStarted) {
    dueDate = startDate;
  } else {
    dueDate = getCurrentCycleDueDate(today, dueDay);

    if (startDate && dueDate < startDate) {
      dueDate = startDate;
    }
  }

  const nextDueDate = getNextScheduledDueDate(dueDate, dueDay);

  const graceEndsOn = addDays(
    dueDate,
    Math.max(0, gracePeriodDays - 1)
  );

  const initialLateFeeDate =
    config.lateFeeEnabled &&
    sanitizeNonNegativeInt(config.lateFeeInitialCents, 0) > 0
      ? addDays(graceEndsOn, 1)
      : null;

  let dailyLateFeeStartDate: NullableDate = null;
  let dailyLateFeeLastDate: NullableDate = null;

  const dailyLateFeeCents = sanitizeNonNegativeInt(
    config.lateFeeDailyCents,
    0
  );

  const maxLateFeeDays = sanitizeNonNegativeInt(
    config.maxLateFeeDays,
    0
  );

  if (
    config.lateFeeEnabled &&
    dailyLateFeeCents > 0 &&
    maxLateFeeDays > 0
  ) {
    dailyLateFeeStartDate = addDays(
      initialLateFeeDate ?? graceEndsOn,
      1
    );

    dailyLateFeeLastDate = addDays(
      dailyLateFeeStartDate,
      maxLateFeeDays - 1
    );
  }

  const isDelinquent =
    hasStarted && today > graceEndsOn;

  return {
    hasStarted,
    billingCycle: getBillingCycleKey(dueDate),
    dueDate: toDateOnlyString(dueDate),
    nextDueDate: toDateOnlyString(nextDueDate),
    graceEndsOn: toDateOnlyString(graceEndsOn),
    initialLateFeeDate: initialLateFeeDate
      ? toDateOnlyString(initialLateFeeDate)
      : null,
    dailyLateFeeStartDate: dailyLateFeeStartDate
      ? toDateOnlyString(dailyLateFeeStartDate)
      : null,
    dailyLateFeeLastDate: dailyLateFeeLastDate
      ? toDateOnlyString(dailyLateFeeLastDate)
      : null,
    isDelinquent,
  };
}

export function getBillingCycleKey(date: Date): string {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

export function getNextBillingCycleKey(
  billingCycle: string
): string {
  const match = /^(\d{4})-(\d{2})$/.exec(
    String(billingCycle).trim()
  );

  if (!match) {
    throw new Error(`Invalid billing cycle: ${billingCycle}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid billing cycle: ${billingCycle}`);
  }

  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

function getCurrentCycleDueDate(
  today: Date,
  dueDay: number
): Date {
  let year = today.getFullYear();
  let month = today.getMonth() + 1;

  const thisMonthDueDate = createDateOnly(
    year,
    month,
    clampDay(year, month, dueDay)
  );

  if (today >= thisMonthDueDate) {
    return thisMonthDueDate;
  }

  if (month === 1) {
    year -= 1;
    month = 12;
  } else {
    month -= 1;
  }

  return createDateOnly(
    year,
    month,
    clampDay(year, month, dueDay)
  );
}

function getNextScheduledDueDate(
  currentDueDate: Date,
  dueDay: number
): Date {
  let year = currentDueDate.getFullYear();
  let month = currentDueDate.getMonth() + 2;

  if (month === 13) {
    month = 1;
    year += 1;
  }

  return createDateOnly(
    year,
    month,
    clampDay(year, month, dueDay)
  );
}

function getBusinessDateParts(date: Date): CalendarParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function parseDateOnly(value: string): Date | null {
  const raw = String(value).trim();

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);

  if (isoMatch) {
    return createValidatedDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    );
  }

  const usMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);

  if (usMatch) {
    return createValidatedDate(
      Number(usMatch[3]),
      Number(usMatch[1]),
      Number(usMatch[2])
    );
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return getBusinessDate(parsed);
}

function createValidatedDate(
  year: number,
  month: number,
  day: number
): Date | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return createDateOnly(year, month, day);
}

function createDateOnly(
  year: number,
  month: number,
  day: number
): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function clampDay(
  year: number,
  month: number,
  day: number
): number {
  return Math.max(
    1,
    Math.min(clampDueDay(day), daysInMonth(year, month))
  );
}

function clampDueDay(value: unknown): number {
  const day = sanitizeNonNegativeInt(value, 1);
  return Math.max(1, Math.min(day, 31));
}

function sanitizeNonNegativeInt(
  value: unknown,
  fallback: number
): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(number));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateOnlyString(date: Date): string {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}