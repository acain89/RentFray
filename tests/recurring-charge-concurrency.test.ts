import { test } from "node:test";
import assert from "node:assert/strict";
import { configurationFixture, november } from "./recurring-charge-configuration.test";

test("Property lock precedes authoritative reads and writes", async () => {
  const f = configurationFixture(); await f.save([{ label: "Fee", amount: 20 }]);
  const lock = f.events.indexOf("property:lock"); assert.equal(lock, 0);
  assert.ok(f.events.indexOf("property:read") > lock); assert.ok(f.events.indexOf("charges:update") > lock);
});
test("modeled competing saves serialize to one last committed snapshot", async () => {
  const f = configurationFixture(); const results = await Promise.all([f.save([{ label: "Fee", amount: 20 }]), f.save([{ label: "Fee", amount: 25 }])]);
  assert.ok(results.every(r => r.status === 200)); assert.deepEqual(f.applicable(november).map((r: any) => r.amountCents), [2500]);
  assert.equal(f.state.rows.filter((r: any) => !r.isActive).length, 1);
});
test("tier scope is revalidated after locking, not from an earlier snapshot", async () => {
  const f = configurationFixture(); f.controls.onLock = () => { f.state.tiers[0].isActive = false; };
  assert.equal((await f.save([{ label: "Fee", amount: 20 }])).status, 400);
  assert.equal(f.events[0], "property:lock"); assert.equal(f.events[1], "property:read");
  assert.equal(f.state.rows[0].effectiveUntil, null); assert.ok(!f.events.includes("charges:update"));
});
test("insert failure rolls back interval closure and pending cancellation; does not retry", async () => {
  const f = configurationFixture(); await f.save([{ label: "Fee", amount: 20 }]); const before = structuredClone(f.state.rows);
  f.controls.failInsert = true; const attempts = f.controls.attempts;
  assert.equal((await f.save([{ label: "Fee", amount: 25 }])).status, 500);
  assert.deepEqual(structuredClone(f.state.rows), before); assert.equal(f.controls.attempts, attempts + 1);
});
test("retryable failure restarts the whole replacement transaction", async () => {
  const f = configurationFixture(); f.controls.retryFailures = 1;
  assert.equal((await f.save([{ label: "Fee", amount: 20 }])).status, 200);
  assert.equal(f.controls.attempts, 2); assert.equal(f.events.filter(e => e === "property:lock").length, 2);
  assert.deepEqual(f.applicable(november).map((r: any) => r.amountCents), [2000]);
});
test("bounded retry exhaustion leaves original configuration intact", async () => {
  const f = configurationFixture(); const before = structuredClone(f.state.rows); f.controls.retryFailures = 9;
  assert.equal((await f.save([{ label: "Fee", amount: 20 }])).status, 500);
  assert.equal(f.controls.attempts, 3); assert.deepEqual(f.state.rows, before);
});
