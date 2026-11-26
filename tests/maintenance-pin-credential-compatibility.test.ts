
import { test } from "node:test";
import assert from "node:assert/strict";






import { loginFixture, bcryptHash, scryptHash, malformed } from "./maintenance-pin-credential-compatibility.fixture";

for (const [format, hash, correct] of [["bcrypt", bcryptHash, "1234"], ["scrypt", scryptHash, "5678"]]) {
  test(format + " correct PIN retains identity, cookie, and lastLoginAt only", async () => {
    const f = loginFixture([{ id: "worker", pinHash: hash }]);
    const result = await f.post(correct);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, role: "MAINTENANCE", propertyId: "p", maintenanceUserId: "worker" });
    assert.deepEqual(f.sessions, [{ role: "MAINTENANCE", propertyId: "p", maintenanceUserId: "worker" }]);
    assert.deepEqual(f.events, ["admission", "workers", format, "session", "cookie", "lastLoginAt"]);
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0].where.id, "worker");
    assert.deepEqual(Object.keys(f.writes[0].data), ["lastLoginAt"]);
    assert.ok(f.writes[0].data.lastLoginAt instanceof Date);
  });
  test(format + " wrong PIN fails without session or credential rewrite", async () => {
    const f = loginFixture([{ id: "worker", pinHash: hash }]);
    assert.equal((await f.post("0000")).status, 401); assert.equal(f.sessions.length, 0); assert.equal(f.writes.length, 0);
  });
}
for (const hash of malformed) test("unknown/malformed credential rejected: " + hash.slice(0, 20), async () => {
  const f = loginFixture([{ id: "bad", pinHash: hash }]);
  assert.equal((await f.post()).status, 401); assert.equal(f.sessions.length, 0); assert.equal(f.writes.length, 0);
  assert.deepEqual(f.events, ["admission", "workers"]);
});
test("malformed record does not block a later valid worker", async () => {
  const f = loginFixture([{ id: "bad", pinHash: "plain:1234" }, { id: "good", pinHash: bcryptHash }]);
  assert.equal((await f.post()).body.maintenanceUserId, "good");
});
test("bcrypt verifier failure does not block a later valid historical worker", async () => {
  const f = loginFixture([{ id: "bad", pinHash: bcryptHash }, { id: "good", pinHash: scryptHash }], false,
    { compare: async () => { throw Error("Malformed bcrypt record"); } });
  assert.equal((await f.post("5678")).body.maintenanceUserId, "good");
});
for (const [pin, id] of [["1234", "bcrypt-worker"], ["5678", "scrypt-worker"]]) test("mixed worker identities " + id, async () => {
  const f = loginFixture([{ id: "unknown", pinHash: "bad" }, { id: "bcrypt-worker", pinHash: bcryptHash }, { id: "scrypt-worker", pinHash: scryptHash }]);
  assert.equal((await f.post(pin)).body.maintenanceUserId, id);
});
for (const worker of [{ id: "inactive", pinHash: bcryptHash, isActive: false }, { id: "foreign", pinHash: scryptHash, propertyId: "other" }]) {
  test(worker.id + " excluded by scoped active query", async () => {
    const f = loginFixture([worker]); assert.equal((await f.post(worker.id === "foreign" ? "5678" : "1234")).status, 401);
    assert.deepEqual(f.events, ["admission", "workers"]);
  });
}
test("throttle denial prevents both algorithms and all resource/session work", async () => {
  const f = loginFixture([{ id: "bcrypt", pinHash: bcryptHash }, { id: "scrypt", pinHash: scryptHash }], true);
  const result = await f.post(); assert.equal(result.status, 429); assert.equal(result.headers["Retry-After"], "30");
  assert.deepEqual(f.events, ["admission"]); assert.equal(f.sessions.length, 0); assert.equal(f.writes.length, 0);
});
