import { requiredText } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";




import { fixture } from "./tenant-login-assignment-race.fixture";


test("login captures A before verification, signs A under locks and sets cookie after commit", async () => {
  const f = fixture(); assert.equal((await f.login()).status, 200);
  assert.equal(f.tokens[0].tenantAssignmentId, "a"); assert.equal(f.cookies.length, 1);
  const names = f.events.map(e => e[0]);
  assert.ok(names.indexOf("assignment.read") < names.indexOf("verify"));
  assert.ok(names.indexOf("verify") < names.indexOf("begin"));
  assert.ok(names.indexOf("commit") < names.indexOf("clearPinAttempts"));
  assert.ok(names.indexOf("commit") < names.indexOf("cookie"));
  const rows = f.events.filter(e => e[0] === "row").map(e => requiredText(e[1]));
  assert.ok(rows[0].includes('FROM "Property"')); assert.ok(rows[1].includes('FROM "TenantAssignment"')); assert.ok(rows[2].includes('FROM "Unit"'));
  assert.equal(f.events.filter(e => e[0] === "advisory").length, 0);
  assert.equal(f.state().ledger.length, 0);
});
for (const change of ["vacated", "replaced", "pin", "portal", "inactive", "property", "unit-property", "assignment-property", "assignment-unit", "expired-departure"]) {
  test("login rejects post-verification " + change + " without clearing failures or issuing authority", async () => {
    const f = fixture(); f.lockout.recordFailedAttempt("u");
    f.controls.onLock = () => {
      if (change === "replaced") f.replace();
      else if (change === "vacated") f.state().assignments[0].isCurrent = false;
      else if (change === "pin") f.state().unit.tenantPinHash = "new-hash";
      else if (change === "portal") f.state().unit.portalActivated = false;
      else if (change === "inactive") f.state().unit.isActive = false;
      else if (change === "property") f.state().unit.property.isActive = false;
      else if (change === "unit-property") f.state().unit.propertyId = "other";
      else if (change === "assignment-property") f.state().assignments[0].propertyId = "other";
      else if (change === "assignment-unit") f.state().assignments[0].unitId = "other";
      else f.state().assignments[0].moveOutDate = new Date(0);
    };
    assert.equal((await f.login()).status, 401); assert.equal(f.tokens.length, 0); assert.equal(f.cookies.length, 0);
    assert.ok(!f.events.some(e => e[0] === "clearPinAttempts"));
    for (let i = 0; i < 4; i++) f.lockout.recordFailedAttempt("u");
    assert.equal(f.lockout.checkPinAllowed("u").ok, false);
  });
}
test("replacement between captured credential and transaction cannot substitute B", async () => {
  const f = fixture(); f.controls.onVerify = f.replace; assert.equal((await f.login()).status, 401); assert.equal(f.tokens.length, 0);
  const finalReads = f.events.filter(e => e[0] === "assignment.read" && e[1]); assert.equal(finalReads[0][2], "a");
});
test("wrong PIN keeps five-failure lockout and avoids locked issuance", async () => {
  const f = fixture(); f.controls.validPin = false;
  for (let i = 0; i < 5; i++) assert.equal((await f.login()).status, 401);
  f.controls.validPin = true; assert.equal((await f.login()).status, 429);
  assert.equal(f.tokens.length, 0); assert.ok(!f.events.some(e => e[0] === "begin"));
});
for (const code of ["1234", "12345", "0123", "01234"]) test("exact property code preserved " + code, async () => {
  const f = fixture(); f.state().unit.property.propertyCode = code; assert.equal((await f.login()).status, 200);
});
