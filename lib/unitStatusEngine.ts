export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

export type UnitDisplayStatus =
  | "PAID"
  | "PENDING"
  | "FAILED"
  | "GRACE"
  | "PAST_DUE"
  | "UNPAID";

export type UnitStatusColor =
  | "green"
  | "yellow"
  | "orange"
  | "blue"
  | "red";

export type UnitStatusInput = {
  balanceCents: number;
  currentCycleBalanceCents: number;
  hasPendingPayment: boolean;
  hasFailedPayment: boolean;
  hasReversedPayment: boolean;
  isDelinquent: boolean;
  isWithinGracePeriod: boolean;
};

export type UnitStatusResult = {
  status: UnitDisplayStatus;
  paymentStatus: PaymentStatus;
  color: UnitStatusColor;
  label: string;
  tenantMessage: string;
};

export function getUnitStatus(input: UnitStatusInput): UnitStatusResult {
  const balanceCents = Math.trunc(Number(input.balanceCents) || 0);
  const currentCycleBalanceCents = Math.trunc(
    Number(input.currentCycleBalanceCents) || 0
  );

  if (input.hasPendingPayment) {
    return {
      status: "PENDING",
      paymentStatus: "PENDING",
      color: "yellow",
      label: "Payment pending",
      tenantMessage: "Your payment is pending. Your balance will update after the payment clears.",
    };
  }

  if (input.hasFailedPayment || input.hasReversedPayment) {
    return {
      status: "FAILED",
      paymentStatus: "FAILED",
      color: "orange",
      label: "Payment failed",
      tenantMessage: "Your payment failed or was reversed. Please submit a new payment.",
    };
  }

  if (balanceCents <= 0 || currentCycleBalanceCents <= 0) {
    return {
      status: "PAID",
      paymentStatus: "PAID",
      color: "green",
      label: "Paid",
      tenantMessage: "Your balance is paid.",
    };
  }

  if (input.isWithinGracePeriod) {
    return {
      status: "GRACE",
      paymentStatus: "UNPAID",
      color: "blue",
      label: "Balance due",
      tenantMessage: "You have a balance due, but you are still within the grace period.",
    };
  }

  if (input.isDelinquent) {
    return {
      status: "PAST_DUE",
      paymentStatus: "UNPAID",
      color: "red",
      label: "Past due",
      tenantMessage: "Your balance is past due.",
    };
  }

  return {
    status: "UNPAID",
    paymentStatus: "UNPAID",
    color: "blue",
    label: "Balance due",
    tenantMessage: "You have a balance due.",
  };
}