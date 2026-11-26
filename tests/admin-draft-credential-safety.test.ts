
import { test } from "node:test";
import assert from "node:assert/strict";




import { key, password, data, fixture, assertSafe } from "./admin-draft-credential-safety.fixture";


for (const action of ["Continue", "Back", "Save & Exit"]) test(action + " persists nonsecret draft and keeps live credentials", async () => {
  const f = fixture(); f.restore(); f.enter(); if (action === "Back") f.step(2);
  await f.click(action); const parsed = assertSafe(f.storage.get(key)!);
  assert.equal(parsed.step, action === "Continue" ? 2 : 1);
  assert.equal(f.account().password, password); assert.equal(f.account().confirmPassword, password);
  if (action === "Save & Exit") assert.deepEqual(f.paths, ["/admin?saved=draft"]);
});
test("legacy restore sanitizes persistent copy and never restores credentials", () => {
  const f = fixture(JSON.stringify({ step: 4, data: data(), savedAt: "2026-10-07T12:00:00Z" })); f.restore();
  assert.equal(f.account().password, ""); assert.equal(f.account().confirmPassword, "");
  assert.equal(f.states[0], 4); assert.equal(assertSafe(f.storage.get(key)!).savedAt, "2026-10-07T12:00:00Z");
  const again = fixture(f.storage.get(key)); again.restore();
  assert.equal(again.account().password, ""); assert.equal(again.account().confirmPassword, "");
});
test("sanitizer excludes unknown legacy account fields and preserves nonsecret data", () => {
  const legacy: ReturnType<typeof data> & { account: ReturnType<typeof data>["account"] & { secretToken?: string } } = data(); legacy.account.secretToken = password;
  const f = fixture(JSON.stringify({ step: 2, data: legacy })); f.restore(); assertSafe(f.storage.get(key)!);
});
test("legacy cleanup removes copy if rewriting fails", () => {
  const f = fixture(JSON.stringify({ step: 3, data: data() })); f.failWrite(); f.restore();
  assert.equal(f.storage.has(key), false); assert.equal(f.account().password, ""); assert.equal(f.states[0], 3);
});
for (const raw of ["{", "null", JSON.stringify({ data: { account: { password }, tiers: null } }), JSON.stringify({ password })]) {
  test("malformed legacy draft stays usable: " + raw.slice(0, 20), () => {
    const f = fixture(raw); f.restore(); assert.equal(f.states[6], true); assert.equal(f.account().password, "");
    assert.equal(f.storage.has(key), false); assert.doesNotThrow(f.render);
  });
}
test("unavailable storage keeps wizard usable without credential restoration", () => {
  const f = fixture(); f.unavailable(); f.restore(); assert.equal(f.states[6], true); assert.doesNotThrow(f.render);
});
test("live submission retains credentials and success clears sanitized draft", async () => {
  const f = fixture(); f.restore(); f.enter(); await f.click("Save & Exit"); f.step(6); await f.click("Go Live");
  assert.deepEqual(f.submissions, [data()]); assert.equal(f.storage.has(key), false);
  assert.ok(f.writes.every(raw => !raw.includes(password)));
});
test("failed submission keeps safe draft and live credentials retryable", async () => {
  const f = fixture(); f.restore(); f.enter(); await f.click("Save & Exit"); f.reject(); f.step(6); await f.click("Go Live");
  assertSafe(f.storage.get(key)!); assert.equal(f.account().password, password); assert.deepEqual(f.submissions, [data()]);
});
test("storage write failure preserves existing Save/Exit error behavior", async () => {
  const f = fixture(); f.restore(); f.enter(); f.failWrite(); await f.click("Save & Exit");
  assert.equal(f.storage.has(key), false); assert.equal(f.paths.length, 0);
  assert.equal(f.states[4], "Unable to save your draft locally."); assert.equal(f.states[2], false);
});
