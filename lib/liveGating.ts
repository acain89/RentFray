// lib/liveGating.ts
// [path: lib/liveGating.ts]

type PaymentLike = {
  processorConnected?: boolean | null;
  bankConnected?: boolean | null;
  chargesEnabled?: boolean | null;
  payoutsEnabled?: boolean | null;
  onboardingComplete?: boolean | null;
  requirementsDue?: boolean | null;
  requirementsSummary?: string | null;
  readyForLive?: boolean | null;
  lastSyncedAt?: Date | null;
} | null | undefined;

type PropertyStatus =
  | "TEST"
  | "READY"
  | "LIVE"
  | "PAUSED"
  | "INACTIVE"
  | string;

type PropertyLike = {
  settings?: unknown;
  units?: unknown[] | null;
  paymentConnectionStatus?: PaymentLike;
  isActive?: boolean | null;
  status?: PropertyStatus | null;
} | null | undefined;

type LiveReadiness = {
  hasUnits: boolean;
  hasSettings: boolean;
  stripeConnected: boolean;
  achEnabled: boolean;
  onboardingComplete: boolean;
  paymentReady: boolean;
  readyForLive: boolean;
};

const TENANT_ACCESS_STATUSES: ReadonlySet<string> = new Set([
  "TEST",
  "READY",
  "LIVE",
]);

function normalizeStatus(status: PropertyStatus | null | undefined): string {
  return String(status ?? "").trim().toUpperCase();
}

function isPropertyActive(property: PropertyLike): boolean {
  return property?.isActive !== false;
}

function isTenantAccessibleStatus(property: PropertyLike): boolean {
  return TENANT_ACCESS_STATUSES.has(normalizeStatus(property?.status));
}

export function getLiveReadiness(property: PropertyLike): LiveReadiness {
  const hasUnits = Array.isArray(property?.units) && property.units.length > 0;
  const hasSettings = Boolean(property?.settings);

  const payment = property?.paymentConnectionStatus;

  const stripeConnected = Boolean(payment?.processorConnected);
  const achEnabled = Boolean(payment?.chargesEnabled);
  const payoutsEnabled = Boolean(payment?.payoutsEnabled);
  const onboardingComplete = Boolean(payment?.onboardingComplete);

  const paymentReady =
    Boolean(payment?.processorConnected) &&
    Boolean(payment?.chargesEnabled) &&
    Boolean(payment?.payoutsEnabled);

  const readyForLive = hasUnits && hasSettings && paymentReady;

  return {
    hasUnits,
    hasSettings,
    stripeConnected,
    achEnabled,
    onboardingComplete,
    paymentReady,
    readyForLive,
  };
}

/* =========================
   COMPATIBILITY LAYER
========================= */

export function canManagerOperate(property: PropertyLike): boolean {
  return isPropertyActive(property);
}

export function canTenantLogin(property: PropertyLike): boolean {
  return isPropertyActive(property) && isTenantAccessibleStatus(property);
}

export function canAccessTenantPortal(property: PropertyLike): boolean {
  return isPropertyActive(property) && isTenantAccessibleStatus(property);
}

export function canMakePayments(property: PropertyLike): boolean {
  const readiness = getLiveReadiness(property);
  return isPropertyActive(property) && readiness.paymentReady;
}