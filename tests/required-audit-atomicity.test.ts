import { requiredRecord, requiredValue } from "./fixture-assertions";

import { test } from "node:test";
import assert from "node:assert/strict";




import { cases, fixture } from "./required-audit-atomicity.fixture";

for (const [kind, file, action] of cases) {
  for (const failure of ["audit", "business"] as const) test(kind + ": " + failure + " failure rolls back; retry succeeds once", async () => {
    const f = fixture(kind, file); const before = structuredClone(f.state()); f.fail(failure);
    if (kind === "worker") await assert.rejects(f.call, /failure/); else assert.equal((await f.call()).status, 500);
    assert.deepEqual(f.state(), before); assert.equal(f.transactions(), 1);
    f.fail(null); assert.equal((await f.call()).status, 200); assert.equal(f.state().audits.length, 1);
    assert.equal(f.state().audits[0].action, action);
  });
  test(kind + ": success preserves business result and writes required audit", async () => {
    const f = fixture(kind, file); const result = await f.call(); assert.equal(result.status, 200);
    assert.equal(f.transactions(), 1); assert.equal(f.state().audits.length, 1); assert.equal(f.state().audits[0].action, action);
    if (kind === "password") { assert.equal(f.state().user.passwordHash, "new-hash"); assert.equal(requiredRecord(requiredRecord(result.body).user).mustResetPassword, false); }
    if (kind.startsWith("pin") || kind === "worker") assert.equal(requiredValue(f.state().worker).pinHash, "new-hash");
    if (kind === "status") { assert.equal(requiredRecord(requiredRecord(result.body).request).status, "COMPLETE"); assert.ok(f.state().maintenance.completedAt); }
    if (kind === "live") assert.equal(requiredRecord(requiredRecord(result.body).property).status, "LIVE");
    if (kind === "repair") assert.equal(requiredRecord(requiredRecord(result.body).paymentStatus).processorConnected, false);
    if (kind === "sync") { assert.equal(requiredRecord(requiredRecord(result.body).paymentStatus).chargesEnabled, true); assert.equal(f.stripeCalls(), 1); }
  });
}
test("repair preserves an established connection row", async () => {
  const f = fixture("repair", cases[6][1]); const connection = { id: "existing", processorConnected: true, payoutsEnabled: true, lastSyncedAt: "original" };
  f.state().connection = { ...connection }; await f.call(); assert.deepEqual(f.state().connection, connection);
});
