import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSource } from "./maintenance-pin-credential-compatibility.test";

function fixture(existing: any = null) {
  let row = existing ? { ...existing } : null;
  const calls: any[] = [];
  const forbidden = new Proxy({}, { get() { throw Error("Unexpected database access"); } });
  const api = loadSource("lib/propertySettings.ts", { "@/lib/prisma": { prisma: {
    property: forbidden, paymentConnectionStatus: forbidden,
    propertySettings: {
      findUnique: async () => { throw Error("Read-merge-write forbidden"); },
      upsert: async (query: any) => {
        calls.push(query); assert.equal(query.where.propertyId, "p");
        row = row ? { ...row, ...query.update } : { ...query.create }; return row;
      },
    },
  } } });
  return { calls, row: () => row, save: (data: any) => api.upsertPropertySettings("p", data) };
}
const unrelated = { convenienceFeeEnabled: true, convenienceFeeType: "FLAT", convenienceFeeAmountCents: 495,
  allowTestMode: false, tenantPortalEnabled: false, maintenancePortalEnabled: false, onboardingComplete: true, setupComplete: true };
for (const field of Object.keys(unrelated)) test("omitted " + field + " is absent from update and preserved", async () => {
  const f = fixture({ ...unrelated, gracePeriodDays: 5, lateFeeFlatCents: 5000, lateFeeEnabled: true, rentDueDay: 17 });
  await f.save({ gracePeriodDays: 7, lateFeeFlatCents: 1234, lateFeeEnabled: true });
  assert.equal(Object.hasOwn(f.calls[0].update, field), false);
  assert.equal(f.row()[field], (unrelated as any)[field]);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].update)), { gracePeriodDays: 7, lateFeeFlatCents: 1234, lateFeeEnabled: true });
});
test("creation defaults unchanged", async () => {
  const f = fixture(); await f.save({ gracePeriodDays: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(f.row())), { propertyId: "p", rentDueDay: 1, gracePeriodDays: 5,
    lateFeeFlatCents: null, lateFeeEnabled: false, convenienceFeeEnabled: false, convenienceFeeType: null,
    convenienceFeeAmountCents: null, allowTestMode: true, tenantPortalEnabled: true, maintenancePortalEnabled: true,
    onboardingComplete: false, setupComplete: false });
});
for (const [grace, cents, expectedGrace, expectedCents] of [[-2, -1, 0, 0], [7.9, 1234.9, 7, 1234], [NaN, NaN, 0, 0]]) {
  test("creation/update normalization " + grace + "/" + cents, async () => {
    for (const existing of [null, { ...unrelated }]) {
      const f = fixture(existing); await f.save({ gracePeriodDays: grace, lateFeeFlatCents: cents });
      assert.equal(f.row().gracePeriodDays, expectedGrace); assert.equal(f.row().lateFeeFlatCents, expectedCents);
      assert.equal(f.row().lateFeeEnabled, expectedCents > 0);
    }
  });
}
test("explicit false, zero, and nullable values remain writable", async () => {
  const f = fixture({ ...unrelated, lateFeeFlatCents: 5000, lateFeeEnabled: true });
  const data = { gracePeriodDays: 0, lateFeeFlatCents: null, lateFeeEnabled: false, convenienceFeeEnabled: false,
    convenienceFeeType: null, convenienceFeeAmountCents: 0, allowTestMode: false, tenantPortalEnabled: false,
    maintenancePortalEnabled: false, onboardingComplete: false, setupComplete: false };
  await f.save(data); assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].update)), data);
  await f.save({ gracePeriodDays: 0, convenienceFeeAmountCents: null });
  assert.equal(f.calls[1].update.convenienceFeeAmountCents, null);
});
test("omitted/undefined optional fee fields preserve state; supplied amount retains derivation", async () => {
  const f = fixture({ ...unrelated, lateFeeFlatCents: 5000, lateFeeEnabled: true });
  await f.save({ gracePeriodDays: 3, lateFeeFlatCents: undefined, lateFeeEnabled: undefined, setupComplete: undefined });
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].update)), { gracePeriodDays: 3 });
  assert.equal(f.row().lateFeeFlatCents, 5000); assert.equal(f.row().lateFeeEnabled, true);
  await f.save({ gracePeriodDays: 3, lateFeeFlatCents: 0 }); assert.equal(f.row().lateFeeEnabled, false);
  await f.save({ gracePeriodDays: 3, lateFeeFlatCents: 1500, lateFeeEnabled: false }); assert.equal(f.row().lateFeeEnabled, false);
});
test("due day update remains excluded; lifecycle/hard-start/payment state inaccessible", async () => {
  const f = fixture({ ...unrelated, rentDueDay: 17 });
  await f.save({ gracePeriodDays: 3, rentDueDay: 9, status: "LIVE", rentFrayStartDate: "2030-01-01", chargesEnabled: true });
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].update)), { gracePeriodDays: 3 });
  assert.equal(f.row().rentDueDay, 17);
  const created = fixture(); await created.save({ gracePeriodDays: 5, rentDueDay: 99 }); assert.equal(created.row().rentDueDay, 31);
});
test("stale explicitly submitted settings use last-write-wins without copying unrelated values", async () => {
  const f = fixture({ ...unrelated, gracePeriodDays: 7, convenienceFeeAmountCents: 999 });
  await f.save({ gracePeriodDays: 3 }); assert.equal(f.row().gracePeriodDays, 3);
  assert.equal(f.row().convenienceFeeAmountCents, 999); assert.equal(f.calls.length, 1);
});
