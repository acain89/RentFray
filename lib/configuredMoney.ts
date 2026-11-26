import type { PropertyTier, Unit, UnitRecurringFee } from "@prisma/client";

/** Configuration projections only. Balances and Checkout fees retain their existing authorities. */
export function configuredCents(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export function formatConfiguredMoney(value: unknown): string {
  const amount = configuredCents(value);
  if (amount === null) return "Unavailable";
  const cents = BigInt(amount);
  return `$${(cents / BigInt(100)).toLocaleString("en-US")}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}

type TierRent = Pick<PropertyTier, "id" | "propertyId" | "baseRentCents">;
type UnitIdentity = Pick<Unit, "id" | "propertyId" | "tierId">;
/** Matches monthlyRent's tier-based source; never falls back to the legacy unit override. */
export function currentTierRentCents(unit: UnitIdentity & { tier?: TierRent | null }): number | null {
  if (!unit.tierId || !unit.tier || unit.tier.id !== unit.tierId || unit.tier.propertyId !== unit.propertyId) return null;
  return configuredCents(unit.tier.baseRentCents);
}
export function configuredUnitAddOnsCents(unit: Pick<Unit, "id" | "propertyId">,
  fees: readonly Pick<UnitRecurringFee, "propertyId" | "unitId" | "isActive" | "amountCents">[] | null | undefined): number | null {
  if (!fees) return null;
  let total = 0;
  for (const fee of fees) {
    if (!fee.isActive) continue;
    const amount = configuredCents(fee.amountCents);
    if (fee.propertyId !== unit.propertyId || fee.unitId !== unit.id || amount === null || !Number.isSafeInteger(total + amount)) return null;
    total += amount;
  }
  return total;
}
