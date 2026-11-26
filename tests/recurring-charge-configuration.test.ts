import { requiredDate, requiredText } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";




import { october, november, configurationFixture } from "./recurring-charge-configuration.fixture";


test("replacement preserves October and presents only November", async () => {
  const f = configurationFixture(); assert.equal((await f.save([{ label: "Trash", amount: 20 }])).status, 200);
  assert.equal(requiredDate(f.state.rows[0].effectiveUntil).getTime(), november.getTime());
  assert.deepEqual(f.applicable(october).map((r) => r.amountCents), [1000]);
  assert.deepEqual(f.applicable(november).map((r) => r.amountCents), [2000]);
  assert.deepEqual((await f.get()).body.tiers[0].charges.map((r) => r.amount), [20]);
});
test("empty replacement closes old set without fake rows or GET fallback", async () => {
  const f = configurationFixture(); assert.equal((await f.save()).status, 200);
  assert.equal(f.state.rows.length, 1); assert.equal(f.applicable(october).length, 1); assert.equal(f.applicable(november).length, 0);
  assert.equal((await f.get()).body.tiers[0].charges.length, 0);
});
test("pending replacement, repeated save and same-label legitimate items", async () => {
  const f = configurationFixture(); await f.save([{ label: "Trash", amount: 20 }]);
  const pending = f.state.rows[1].id;
  for (let i = 0; i < 2; i++) await f.save([{ label: "Trash", amount: 25 }, { label: "Trash", amount: 5 }]);
  assert.equal(f.state.rows.find((r) => r.id === pending)?.isActive, false);
  assert.deepEqual(f.applicable(november).map((r) => r.amountCents), [2500, 500]);
  assert.equal(f.applicable(october)[0].amountCents, 1000);
});
for (const body of [{}, { tiers: null }, { tiers: [] }, { tiers: [null] }, { tiers: [{ tierId: "foreign", charges: [] }] },
  { tiers: [{ tierId: "t" }] }, { tiers: [{ tierId: "t", charges: [] }, { tierId: "t", charges: [] }] },
  { tiers: [{ tierId: "t", charges: [null] }] }, { tiers: [{ tierId: "t", charges: [{ label: "Bad", amount: -1 }] }] }])
  test("malformed/foreign snapshot rejected: " + JSON.stringify(body), async () => {
    const f = configurationFixture(); const before = structuredClone(f.state.rows); const result = await f.save([], body);
    assert.ok(result.status >= 400 && result.status < 500); assert.deepEqual(f.state.rows, before);
  });
test("UI blank draft is an explicit empty tier and Chicago boundary ignores UTC month rollover", async () => {
  const f = configurationFixture(); f.controls.now = "2026-11-01T01:00:00Z";
  const r = await f.save([{ label: "", amount: "" }]); assert.equal(r.status, 200);
  assert.equal(new Date(requiredText(r.body.effectiveDate)).getTime(), november.getTime());
  assert.equal(f.applicable(november).length, 0);
});
test("missing tier blocks cannot erase another active tier", async () => {
  const f = configurationFixture(); f.state.tiers.push({ id: "second", name: "Second", sortOrder: 1, isActive: true });
  assert.equal((await f.save()).status, 400); assert.equal(f.state.rows[0].effectiveUntil, null);
});
test("explicit empty snapshot is permitted when no active tiers exist", async () => {
  const f = configurationFixture(); f.state.tiers = [];
  assert.equal((await f.save([], { tiers: [] })).status, 200);
});
