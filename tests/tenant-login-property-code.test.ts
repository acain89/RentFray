import { eventArguments, requiredRecord } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";




import { fixture } from "./tenant-login-property-code.fixture";

for (const code of ["1234", "12345", "0123", "01234"]) test("valid exact string code " + code, async () => {
  const f = fixture(code); assert.equal((await f.login()).status, 200);
  assert.equal(requiredRecord(eventArguments(f.events, "property").where).propertyCode, code);
  assert.deepEqual(JSON.parse(JSON.stringify(eventArguments(f.events, "session"))), { role: "TENANT", propertyId: "p", unitId: "u", tenantAssignmentId: "assignment" });
});
for (const code of ["1234", "12345"]) test("unknown valid code " + code, async () => {
  const f = fixture(code); f.controls.property = false; assert.equal((await f.login()).status, 401);
  assert.ok(f.events.some(e => e[0] === "property")); assert.ok(!f.events.some(e => e[0] === "verify" || e[0] === "session"));
});
for (const code of ["123", "123456", "ABCD", "12A4", "", "1234.0"]) test("malformed code rejects before lookup " + code, async () => {
  const f = fixture(); assert.equal((await f.login({ propertyCode: code })).status, 400); assert.deepEqual(f.events.map(e => e[0]), ["ip"]);
});
test("whitespace trim and unit normalization", async () => {
  const f = fixture("01234"); assert.equal((await f.login({ propertyCode: " 01234 ", unitNumber: " 1 ", pin: " 1234 " })).status, 200);
  assert.equal(requiredRecord(eventArguments(f.events, "property").where).propertyCode, "01234");
});
for (const condition of ["propertyActive", "unitActive", "activated", "hash", "assignment", "validPin"] as const) test("existing eligibility denied " + condition, async () => {
  const f = fixture("12345"); f.controls[condition] = false; assert.ok((await f.login()).status >= 400); assert.ok(!f.events.some(e => e[0] === "session"));
});
test("foreign unit and submitted identity cannot substitute", async () => {
  const f = fixture(); assert.equal((await f.login({ unitNumber: "foreign", propertyId: "other", unitId: "other", tenantAssignmentId: "other" })).status, 401);
  assert.ok(!f.events.some(e => e[0] === "verify" || e[0] === "session"));
});
test("submitted IDs ignored on legitimate login", async () => {
  const f = fixture(); assert.equal((await f.login({ propertyId: "other", unitId: "other", tenantAssignmentId: "other" })).status, 200);
  assert.equal(eventArguments(f.events, "session").tenantAssignmentId, "assignment");
});
