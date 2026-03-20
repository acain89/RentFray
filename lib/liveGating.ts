// lib/liveGating.ts
// [path: lib/liveGating.ts]

type PaymentLike = {
  stripeConnected?: boolean | null;
  achEnabled?: boolean | null;
  onboardingComplete?: boolean | null;
  adminApproved?: boolean | null;
} | null | undefined;

type PropertyLike = {
  settings?: unknown;
  units?: Array<unknown>;
  paymentConnectionStatus?: PaymentLike;
} | null | undefined;

export function getLiveReadiness(property: PropertyLike) {
  const hasUnits = Boolean(property?.units && property.units.length > 0);
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