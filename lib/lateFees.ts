export function getLateFeePreview({
  balance,
  isDelinquent,
  settings,
}: {
  balance: number;
  isDelinquent: boolean;
  settings: {
    lateFeeType: string;
    lateFeeValue: number;
  };
}) {
  if (!isDelinquent || balance <= 0) {
    return {
      recommendedLateFee: 0,
      eligible: false,
      reason: "Not delinquent",
      basedOnBalance: balance,
      evaluatedAt: new Date(),
    };
  }

  let fee = 0;

  if (settings.lateFeeType === "PERCENT") {
    fee = balance * (settings.lateFeeValue / 100);
  } else {
    fee = settings.lateFeeValue;
  }

  const rounded = Math.round(fee * 100) / 100;

  return {
    recommendedLateFee: rounded,
    eligible: true,
    reason: "Past grace period with outstanding balance",
    basedOnBalance: balance,
    evaluatedAt: new Date(),
  };
}