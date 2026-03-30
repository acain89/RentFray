// lib/liveGating.ts
// [path: lib/liveGating.ts]

type PaymentLike = {
  stripeConnected?: boolean | null;
  achEnabled?: boolean | null;
  onboardingComplete?: boolean | null;
  adminApproved?: boolean | null;
} | null | undefined;

type PropertyStatus = "TEST" | "READY" | "LIVE" | "PAUSED" | "INACTIVE" | string;

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
  adminApproved: boolean;
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

  const stripeConnected = Boolean(payment?.stripeConnected);
  const achEnabled = Boolean(payment?.achEnabled);
  const onboardingComplete = Boolean(payment?.onboardingComplete);
  const adminApproved = Boolean(payment?.adminApproved);

  const paymentReady =
    stripeConnected && achEnabled && onboardingComplete && adminApproved;

  const readyForLive = hasUnits && hasSettings && paymentReady;

  return {
    hasUnits,
    hasSettings,
    stripeConnected,
    achEnabled,
    onboardingComplete,
    adminApproved,
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