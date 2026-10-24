/** Write-time policy only. Historical billing calendars must not be capped. */
export const GRACE_PERIOD_MESSAGE = "Grace period must be a whole number between 0 and 25 days.";
export const GRACE_PERIOD_LEGACY_MESSAGE = "This saved grace period is preserved. If changed, it must be a whole number between 0 and 25 days.";
export const MAX_GRACE_PERIOD_DAYS = 25;

export class GracePeriodError extends Error {
  constructor() { super(GRACE_PERIOD_MESSAGE); }
}

export function parseGracePeriod(value: unknown, savedValue?: number): number {
  if (typeof value !== "number" && typeof value !== "string") throw new GracePeriodError();
  // Reject blank, exponent/hex syntax, and coercible objects before Number().
  if (typeof value === "string" && !/^\d+(?:\.0+)?$/.test(value.trim())) throw new GracePeriodError();
  const days = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isSafeInteger(days) || days < 0) throw new GracePeriodError();
  if (days <= MAX_GRACE_PERIOD_DAYS) return days;
  if (typeof savedValue === "number" && Number.isSafeInteger(savedValue) && savedValue > MAX_GRACE_PERIOD_DAYS && days === savedValue) return days;
  throw new GracePeriodError();
}

export function gracePeriodError(value: unknown, savedValue?: number): string | undefined {
  try { parseGracePeriod(value, savedValue); return undefined; }
  catch { return GRACE_PERIOD_MESSAGE; }
}

export function gracePeriodInputMax(value: unknown, savedValue?: number): number | undefined {
  return savedValue !== undefined && savedValue > MAX_GRACE_PERIOD_DAYS && !gracePeriodError(value, savedValue) && Number(value) === savedValue
    ? undefined : MAX_GRACE_PERIOD_DAYS;
}
