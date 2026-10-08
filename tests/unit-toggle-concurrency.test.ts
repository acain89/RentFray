import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./manual-payment-idempotency.test";

// Explicit scheduling model, not a proof of PostgreSQL MVCC/locking behavior.
function barrier() {
  let release!: () => void;
  const reached = new Promise<void>(resolve => { release = resolve; });
  return { reached, release };
}
function setup(role = "MANAGER") {
  const f = fixture(role);
  f.state.tenantAssignment = [];
  f.imports["@prisma/client"].Prisma.TransactionIsolationLevel = { Serializable: "Serializable" };
  f.imports["@/lib/session"].requireManagerLevelSession = async () => {
    if (!["OWNER", "MANAGER"].includes(role)) throw new Error("Forbidden");
    return { propertyId: "p", role };
  };
  let tail = Promise.resolve(), attempts = 0, pause = false;
  const firstLocked = barrier(), secondWaiting = barrier(), continueFirst = barrier();
  f.prisma.$transaction = async (fn: (tx: typeof f.prisma) => Promise<unknown>, options: { isolationLevel: string }) => {
    const ordinal = ++attempts;
    let unlock: (() => void) | undefined;
    let snapshot: { state: typeof f.state; tiers: typeof f.tiers } | undefined;
    const tx = { ...f.prisma, $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      assert.match(sql.join("?"), /FROM "Property"[\s\S]*FOR UPDATE/);
      assert.deepEqual(values, ["p"]);
      assert.ok(["ReadCommitted", "Serializable"].includes(options.isolationLevel));
      const previous = tail, done = barrier(); tail = done.reached;
      if (ordinal === 2) secondWaiting.release();
      await previous; unlock = done.release;
      snapshot = structuredClone({ state: f.state, tiers: f.tiers });
      if (pause && ordinal === 1) { firstLocked.release(); await continueFirst.reached; }
      return [];
    } };
    const findFirst = f.prisma.unit.findFirst;
    tx.unit = { ...f.prisma.unit, findFirst: async (args: Parameters<typeof findFirst>[0]) => {
      assert.ok(unlock, "occupancy must be read after the property lock");
      return findFirst(args);
    } };
    try { return await fn(tx); }
    catch (error) {
      if (snapshot) {
        for (const key of Object.keys(f.state)) f.state[key] = snapshot.state[key];
        f.tiers.splice(0, f.tiers.length, ...snapshot.tiers);
      }
      throw error;
    } finally { unlock?.(); }
  };
  const toggle = (makeActive = false, unitId = "u") => f.route("app/api/manager/units/toggle-active/route.ts").POST({ json: async () => ({ unitId, makeActive }) });
  const activate = () => f.route("app/api/tenant/activate/route.ts").POST({ json: async () => ({
    propertyCode: "1234", firstName: "First", lastName: "Last", unitNumber: "1", confirmUnitNumber: "1",
    tierId: "s", pin: "1234", confirmPin: "1234", recentMoveIn: false, moveInDate: null,
  }) });
  return { ...f, toggle, activate, firstLocked, secondWaiting, continueFirst, pause: () => { pause = true; } };
}
for (const role of ["OWNER", "MANAGER"]) test(`${role} may deactivate vacant unit and reactivate`, async () => {
  const f = setup(role);
  assert.equal((await f.toggle()).status, 200); assert.equal(f.state.units[0].isActive, false);
  assert.equal(f.tiers[0].activeUnitCount, 0);
  assert.equal((await f.toggle(true)).status, 200); assert.equal(f.state.units[0].isActive, true);
  assert.equal(f.tiers[0].activeUnitCount, 1);
});
test("occupied unit rejection preserves the existing error", async () => {
  const f = setup(); f.state.tenantAssignment.push({ id: "a", unitId: "u", propertyId: "p", isCurrent: true, moveOutDate: null });
  const response = await f.toggle(); assert.equal(response.status, 400);
  assert.equal(response.body.error, "Cannot inactivate an occupied unit"); assert.equal(f.state.units[0].isActive, true);
});
test("STAFF cannot toggle and foreign unit is not mutated", async () => {
  const staff = setup("STAFF"); assert.equal((await staff.toggle()).status, 403); assert.equal(staff.events.length, 0);
  const f = setup(); f.state.units[0].propertyId = "other";
  assert.equal((await f.toggle()).status, 404); assert.equal(f.state.units[0].isActive, true);
});
test("activation commits first: waiting deactivation sees occupancy and rejects", { timeout: 10000 }, async () => {
  const f = setup(); f.pause();
  const activation = f.activate(); await f.firstLocked.reached;
  const deactivation = f.toggle(); await f.secondWaiting.reached; f.continueFirst.release();
  assert.equal((await activation).status, 200); assert.equal((await deactivation).status, 400);
  assert.equal(f.state.units[0].isActive, true); assert.equal(f.state.tenantAssignment.length, 1);
});
test("deactivation commits first: waiting activation rejects inactive unit", { timeout: 10000 }, async () => {
  const f = setup(); f.pause();
  const deactivation = f.toggle(); await f.firstLocked.reached;
  const activation = f.activate(); await f.secondWaiting.reached; f.continueFirst.release();
  assert.equal((await deactivation).status, 200); assert.equal((await activation).status, 400);
  assert.equal(f.state.units[0].isActive, false); assert.equal(f.state.tenantAssignment.length, 0);
});
test("repeated/concurrent toggles serialize and retain accurate tier count", async () => {
  const f = setup();
  assert.deepEqual((await Promise.all([f.toggle(), f.toggle()])).map(r => r.status), [200, 200]);
  assert.deepEqual((await Promise.all([f.toggle(true), f.toggle(true)])).map(r => r.status), [200, 200]);
  assert.equal(f.state.units[0].isActive, true); assert.equal(f.tiers[0].activeUnitCount, 1);
});
test("tier update failure rolls back unit and assignment state", async () => {
  const f = setup(); f.controls.fail = "tier.update";
  const before = structuredClone(f.state); assert.ok((await f.toggle()).status >= 400); assert.deepEqual(f.state, before);
});

for (const diagnostic of [
  "deadlock detected: SQL SELECT secret FROM internal_table; PostgreSQL 40P01",
  "PrismaClientUnknownRequestError: database credentials and internal query",
  "Unexpected internal failure",
]) test("internal diagnostic is replaced by generic HTTP 500: " + diagnostic.split(":")[0], async () => {
  const f = setup();
  f.prisma.$transaction = async () => { throw Object.assign(new Error(diagnostic), { code: "P2010" }); };
  const response = await f.toggle();
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: "Server error" });
  assert.equal(f.state.units[0].isActive, true);
});
test("capacity and inactive-tier business rejection messages remain unchanged", async () => {
  const capacity = setup(); capacity.tiers[0].unitCount = 1;
  const response = await capacity.toggle(true);
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Max number of units have been activated for this tier.");
  const tier = setup(); tier.tiers[0].isActive = false;
  const invalid = await tier.toggle(true);
  assert.equal(invalid.status, 404);
  assert.equal(invalid.body.error, "Tier does not belong to property.");
});
test("session rejection and invalid input retain existing response conventions", async () => {
  const f = setup();
  f.imports["@/lib/session"].requireManagerLevelSession = async () => { throw new Error("Unauthorized"); };
  const unauthorized = await f.toggle();
  assert.equal(unauthorized.status, 401); assert.equal(unauthorized.body.error, "Unauthorized");
  f.imports["@/lib/session"].requireManagerLevelSession = async () => ({ propertyId: null });
  assert.equal((await f.toggle()).status, 401);
  f.imports["@/lib/session"].requireManagerLevelSession = async () => ({ propertyId: "p" });
  const invalid = await f.route("app/api/manager/units/toggle-active/route.ts").POST({ json: async () => ({}) });
  assert.equal(invalid.status, 400); assert.equal(invalid.body.error, "Invalid request");
});
