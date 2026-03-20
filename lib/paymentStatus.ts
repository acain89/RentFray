// lib/paymentStatus.ts

export function isPaymentReady(status: {
  stripeConnected: boolean | null;
  achEnabled: boolean | null;
}) {
  return Boolean(status?.stripeConnected && status?.achEnabled);
}