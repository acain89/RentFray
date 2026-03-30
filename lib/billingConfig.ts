export function getProcessingFee(amount: number): number {
  if (amount < 100) return 2.95;
  if (amount < 200) return 3.95;
  if (amount < 300) return 4.95;
  if (amount < 400) return 5.95;
  if (amount < 500) return 6.95;
  if (amount < 800) return 7.95;
  if (amount < 900) return 8.95;
  return 9.95;
}