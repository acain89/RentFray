import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./tenant-login-property-code.test";
test("five wrong PINs establish lock; locked correct and wrong PIN do no authentication work", async () => {
  const f = fixture("1234", true); f.controls.validPin = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.equal((await f.login()).status, 401); assert.equal(f.events.filter(e => e[0] === "verify").length, attempt);
    assert.equal(f.events.filter(e => e[0] === "recordFailedAttempt").length, attempt);
  }
  assert.equal(f.helper.checkPinAllowed("u").ok, false);
  for (const correct of [true, false]) {
    f.controls.validPin = correct; const before = f.events.length; const result = await f.login();
    assert.equal(result.status, 429); assert.equal(result.body.error, "Too many attempts. Try again later.");
    assert.deepEqual(f.events.slice(before).map(e => e[0]), ["ip", "property", "unit", "checkPinAllowed"]);
    assert.equal(f.helper.checkPinAllowed("u").ok, false);
  }
  f.advance(300000); f.controls.validPin = true; assert.equal((await f.login()).status, 200);
  assert.equal(f.helper.checkPinAllowed("u").ok, true); assert.equal(f.events.filter(e => e[0] === "clearPinAttempts").length, 1);
});
test("unlocked success clears prior failures", async () => {
  const f = fixture("1234", true); f.controls.validPin = false;
  for (let i = 0; i < 4; i++) assert.equal((await f.login()).status, 401);
  f.controls.validPin = true; assert.equal((await f.login()).status, 200);
  f.controls.validPin = false; assert.equal((await f.login()).status, 401); assert.equal(f.helper.checkPinAllowed("u").ok, true);
});
test("unknown unit does not enter unit lockout", async () => {
  const f = fixture("1234", true); f.controls.unit = false; assert.equal((await f.login()).status, 401);
  assert.ok(!f.events.some(e => ["checkPinAllowed", "recordFailedAttempt", "clearPinAttempts", "verify", "assignment", "session"].includes(e[0])));
});
test("existing IP limiter rejects before parsing and lookup", async () => {
  const f = fixture("1234", true); f.controls.ipAllowed = false; assert.equal((await f.login()).status, 429);
  assert.deepEqual(f.events, [["ip", "tenant-login:test-ip", 15, 60000]]);
});
