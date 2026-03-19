export function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function daysInMonth(year: number, monthIndexZeroBased: number) {
  return new Date(year, monthIndexZeroBased + 1, 0).getDate();
}

export function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function getProratedRentAmount(
  monthlyRent: number,
  moveInDate: Date
) {
  const rent = Number(monthlyRent || 0);
  const moveIn = startOfDay(moveInDate);

  if (!Number.isFinite(rent) || rent <= 0) {
    return 0;
  }

  const year = moveIn.getFullYear();
  const month = moveIn.getMonth();
  const day = moveIn.getDate();

  const totalDays = daysInMonth(year, month);
  const occupiedDays = totalDays - day + 1;
  const dailyRate = rent / totalDays;

  return roundMoney(dailyRate * occupiedDays);
}

export function getProrationSummary(
  monthlyRent: number,
  moveInDate: Date
) {
  const moveIn = startOfDay(moveInDate);
  const year = moveIn.getFullYear();
  const month = moveIn.getMonth();
  const day = moveIn.getDate();
  const totalDays = daysInMonth(year, month);
  const occupiedDays = totalDays - day + 1;
  const proratedAmount = getProratedRentAmount(monthlyRent, moveInDate);

  return {
    moveInDate: moveIn,
    totalDays,
    occupiedDays,
    proratedAmount,
  };
}