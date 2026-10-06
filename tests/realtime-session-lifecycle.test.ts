import { test } from "node:test";
import assert from "node:assert/strict";
import { streamFixture, flush, sessionFixture } from "./realtime-property-isolation.test";

for (const reason of ["expired", "disabled", "deleted", "role changed", "property changed", "database failure"]) test(`actual ongoing SSOT: ${reason}`, async () => {
  const auth = sessionFixture(); const f = streamFixture("OWNER", auth); await f.connect();
  if (reason === "expired") auth.expire();
  if (reason === "disabled") auth.user.isActive = false;
  if (reason === "deleted") delete auth.user.propertyId;
  if (reason === "role changed") auth.user.role = "STAFF";
  if (reason === "property changed") auth.user.propertyId = "b";
  if (reason === "database failure") auth.fail();
  f.emit({ propertyId: "a" }); await flush(); assert.equal(f.chunks.length, 0); assert.equal(f.state().closed, true);
});

test("successful async validation delivers serially", async () => {
  const f = streamFixture(); await f.connect(); const releases: any[] = [];
  f.setValidator(() => new Promise(resolve => { releases.push(resolve); }));
  f.emit({ propertyId: "a", sequence: 1 }); f.emit({ propertyId: "a", sequence: 2 }); await flush();
  assert.equal(releases.length, 1); releases[0]({ role: "OWNER", propertyId: "a" }); await flush();
  assert.equal(releases.length, 2); assert.equal(f.chunks.length, 1);
  releases[1]({ role: "OWNER", propertyId: "a" }); await flush(); assert.equal(f.chunks.length, 2);
  assert.match(f.chunks[0], /"sequence":1/); assert.match(f.chunks[1], /"sequence":2/);
});

for (const reason of ["expired", "disabled", "deleted", "demoted", "property changed", "database failure"]) {
  test(`open stream fails closed: ${reason}`, async () => {
    const f = streamFixture(); await f.connect();
    f.setValidator(async () => { if (reason === "database failure") throw Error("DB unavailable");
      return reason === "demoted" ? { role: "TENANT", propertyId: "a" }
        : reason === "property changed" ? { role: "OWNER", propertyId: "b" } : null; });
    f.emit({ propertyId: "a" }); await flush(); f.emit({ propertyId: "a" }); await flush();
    assert.equal(f.chunks.length, 0); assert.equal(f.state().closed, true);
    assert.equal(f.state().subscriptions, 0); assert.equal(f.state().timers, 0);
  });
}
test("validation and delivery are serialized and bounded", async () => {
  const f = streamFixture(); await f.connect(); let release: any;
  f.setValidator(() => new Promise(resolve => { release = resolve; }));
  f.emit({ propertyId: "a" }); await flush();
  for (let i = 0; i < 200; i++) f.emit({ propertyId: "a" });
  assert.equal(f.state().validations, 1); assert.equal(f.state().closed, true);
  release({ role: "OWNER", propertyId: "a" }); await flush(); assert.equal(f.chunks.length, 0);
});
test("heartbeat revalidates, preserves ping and revokes idle stream", async () => {
  const f = streamFixture(); const r = await f.connect(); f.tick(); await flush();
  assert.equal(f.chunks[0], ": ping\n\n"); f.setAuthority(null); f.tick(); await flush();
  assert.equal(f.chunks.length, 1); assert.equal(f.state().closed, true); r.body.cancel();
});
for (const action of ["cancel", "abort", "delivery failure", "backpressure"]) test(`${action} cleans all resources`, async () => {
  const f = streamFixture(); const r = await f.connect();
  if (action === "cancel") r.body.cancel();
  else if (action === "abort") f.abort.abort();
  else { if (action === "delivery failure") f.failDelivery(); else f.backpressure(); f.emit({ propertyId: "a" }); }
  await flush(); assert.equal(f.state().subscriptions, 0); assert.equal(f.state().timers, 0);
});
test("abort during validation prevents delivery", async () => {
  const f = streamFixture(); await f.connect(); let release: any;
  f.setValidator(() => new Promise(resolve => { release = resolve; }));
  f.emit({ propertyId: "a" }); await flush(); f.abort.abort();
  release({ role: "OWNER", propertyId: "a" }); await flush(); assert.equal(f.chunks.length, 0);
});
