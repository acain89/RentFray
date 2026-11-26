import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as money from "../lib/configuredMoney";

for (const [input, expected] of [[123456, "$1,234.56"], [0, "$0.00"], [1, "$0.01"], [Number.MAX_SAFE_INTEGER, "$90,071,992,547,409.91"]] as const) {
  test(`configured cents format exactly: ${input}`, () => assert.equal(money.formatConfiguredMoney(input), expected));
}
for (const input of [null, undefined, NaN, Infinity, -1, 0.5, "100", {}, Number.MAX_SAFE_INTEGER + 1]) {
  test(`unavailable money is never fabricated as zero: ${String(input)}`, () => assert.equal(money.formatConfiguredMoney(input), "Unavailable"));
}
const unit = { id: "u", propertyId: "p", tierId: "tier" };
const tier = { id: "tier", propertyId: "p", baseRentCents: 123456 };
test("unit rent follows the assigned tier after changes and ignores the legacy override", () => {
  const legacyUnit = { ...unit, baseRentCents: 500 };
  assert.equal(money.currentTierRentCents({ ...legacyUnit, tier }), 123456);
  assert.equal(money.currentTierRentCents({ ...unit, tier: { ...tier, baseRentCents: 0 } }), 0);
  assert.equal(money.currentTierRentCents({ ...unit, tierId: "new", tier: { ...tier, id: "new", baseRentCents: 200000 } }), 200000);
});
for (const value of [null, undefined, { ...tier, id: "other" }, { ...tier, propertyId: "foreign" }, { ...tier, baseRentCents: -1 }]) {
  test(`missing or inconsistent tier is unavailable: ${JSON.stringify(value)}`, () => assert.equal(money.currentTierRentCents({ ...unit, tier: value }), null));
}
const fee = { propertyId: "p", unitId: "u", isActive: true, amountCents: 1200 };
test("configured add-ons use scoped active integer cents, not ledger balances", () => {
  assert.equal(money.configuredUnitAddOnsCents(unit, [fee, { ...fee, amountCents: 34 }]), 1234);
  assert.equal(money.configuredUnitAddOnsCents(unit, [fee, { ...fee, isActive: false }]), 1200);
  assert.equal(money.configuredUnitAddOnsCents(unit, []), 0);
  assert.equal(money.configuredUnitAddOnsCents(unit, [{ ...fee, amountCents: 0 }]), 0);
  for (const rows of [null, undefined, [{ ...fee, propertyId: "foreign" }], [{ ...fee, unitId: "other" }], [{ ...fee, amountCents: -1 }], [{ ...fee, amountCents: Number.MAX_SAFE_INTEGER }, fee]]) {
    assert.equal(money.configuredUnitAddOnsCents(unit, rows), null);
  }
});
test("all nine administrator projections and the manager view use the reviewed configuration sources", () => {
  const admin = readFileSync("app/admin/properties/[id]/page.tsx", "utf8");
  for (const field of ["property.settings?.lateFeeFlatCents", "property.settings?.convenienceFeeAmountCents", "tier.baseRentCents", "tier.processingFeeCents", "tier.lateFeeInitialCents", "tier.lateFeeDailyCents", "currentTierRentCents({ ...unit, tier })", "configuredUnitAddOnsCents(unit, unit.recurringFeeItems)", "charge.amountCents"]) assert.ok(admin.includes(field), field);
  assert.match(admin, /stored tier processing fee/);
  const manager = readFileSync("app/manager/units/page.tsx", "utf8");
  assert.match(manager, /tier: \{ select: \{ id: true, propertyId: true, baseRentCents: true/);
  assert.match(manager, /formatConfiguredMoney\(currentTierRentCents\(u\)\)/);
  assert.doesNotMatch(manager, /u\.baseRent/);
});
