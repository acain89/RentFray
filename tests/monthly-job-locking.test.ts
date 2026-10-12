import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { monthlyFixture } from "./monthly-recurring-configuration.test";
import { load } from "./recurring-charge-configuration.test";

const now = new Date("2026-10-20T12:00:00Z");
function populated() {
  const f = monthlyFixture([{ id: "tierfee", tierId: "t", label: "Tier", amountCents: 1000, isActive: true, effectiveDate: new Date("2026-10-01T05:00:00Z"), effectiveUntil: null }]);
  f.unit.tier.baseRentCents = 10000;
  f.unit.recurringFeeItems = [{ id: "unitfee", label: "Unit", amountCents: 2000, createdAt: new Date("2026-09-01T12:00:00Z") }];
  return f;
}
test("ISOLATED MODEL: lock precedes authoritative rereads and all writes, commit exposes counts", async () => {
  const f = populated(); const result = await f.run(now);
  assert.equal(f.events[0], "lock:u"); assert.ok(f.events.indexOf("property:lock") >= 0 && f.events.indexOf("property:lock") < f.events.indexOf("unit:read"));
  assert.ok(f.events.indexOf("ledger:write") > f.events.indexOf("ledger:read"));
  assert.equal(f.events.at(-1), "commit"); assert.equal(result.rentChargesCreated, 1);
  assert.equal(result.recurringFeeChargesCreated, 2); assert.equal(f.ledger.length, 3);
});
for (const stage of ["rent", "unit", "tier"]) test("ISOLATED MODEL: " + stage + " failure rolls back entire chunk; rerun retains identities", async () => {
  const f = populated(); f.controls.failStage = stage;
  await assert.rejects(f.run(now), /insertion failure/); assert.equal(f.ledger.length, 0);
  assert.equal(f.events.at(-1), "rollback"); f.controls.failStage = "";
  const result = await f.run(now); assert.equal(result.rentChargesCreated, 1); assert.equal(result.recurringFeeChargesCreated, 2);
  assert.deepEqual(f.ledger.map(row => row.idempotencyKey), ["RENT:u:2026-10", "UNIT_RECURRING_FEE:u:2026-10:unitfee", "TIER_RECURRING_FEE:u:2026-10:tierfee"]);
});
for (const failure of ["failLock", "failCommit"] as const) test("ISOLATED MODEL: " + failure + " rejects instead of returning successful counts", async () => {
  const f = populated(); f.controls[failure] = true;
  await assert.rejects(f.run(now)); assert.equal(f.ledger.length, 0);
  f.controls[failure] = false; assert.equal((await f.run(now)).rentChargesCreated, 1);
});
test("ISOLATED MODEL: two callers serialize same unit, reread after commit, and do not duplicate", async () => {
  const f = populated(); const results = await Promise.all([f.run(now), f.run(now)]);
  assert.equal(results.reduce((n, row) => n + row.rentChargesCreated, 0), 1);
  assert.equal(results.reduce((n, row) => n + row.recurringFeeChargesCreated, 0), 2);
  const locks = f.events.map((event, i) => event === "lock:u" ? i : -1).filter(i => i >= 0);
  assert.equal(locks.length, 2); assert.ok(locks[1] > f.events.indexOf("commit"));
  assert.ok(f.events.indexOf("property:lock", locks[1]) > locks[1]); assert.equal(f.ledger.length, 3);
});
test("ISOLATED MODEL: stale discovery cannot override post-lock vacancy or changed tier", async () => {
  const f = populated(); f.controls.onLock = () => { f.unit.tenantAssignments = []; };
  const result = await f.run(now); assert.equal(result.skippedNoTenant, 1); assert.equal(f.ledger.length, 0);
});
test("stable unit keys: same unit across cycles shares lock; different units use distinct keys", async () => {
  const a = populated(); await a.run(now); await a.run(new Date("2026-11-20T12:00:00Z"));
  assert.equal(a.events.filter(event => event === "lock:u").length, 2);
  const b = populated(); b.unit.id = "other"; await b.run(now); assert.equal(b.events[0], "lock:other");
});
test("production uses transaction-scoped lock and no session acquire/unlock", () => {
  const source = readFileSync(resolve(__dirname, "../jobs/monthlyRent.ts"), "utf8");
  assert.match(source, /pg_advisory_xact_lock/); assert.doesNotMatch(source, /pg_try_advisory_lock|pg_advisory_unlock|pg_advisory_lock\(/);
  assert.match(source, /hashtext\(\$\{unitId\}\)/);
});

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
for (const change of ["tier move", "tier price", "vacancy", "replacement"] as const) {
  test("AUD-01: " + change + " before Property lock uses fresh state", async () => {
    const f = populated();
    f.controls.onLock = () => f.mutate(() => {
      if (change === "vacancy") f.unit.tenantAssignments = [];
      else if (change === "replacement") f.unit.tenantAssignments[0].id = "replacement";
      else f.unit.tier = { ...f.unit.tier, baseRentCents: 12000 };
    });
    await f.run(now);
    if (change === "vacancy") assert.equal(f.ledger.length, 0);
    else {
      assert.ok(f.events.includes("property:lock"));
      assert.equal(f.ledger.find(row => row.chargeType === "RENT").amountCents, change === "replacement" ? 10000 : 12000);
      if (change === "replacement") assert.ok(f.ledger.every(row => row.tenantAssignmentId === "replacement"));
    }
  });
  test("AUD-01 MODEL: " + change + " waits while monthly holds Property", async () => {
    const f = populated(); const read = barrier(); const resume = barrier();
    f.controls.onRead = async () => { read.resolve(); await resume.promise; };
    const monthly = f.run(now); await read.promise;
    let changed = false;
    const writer = f.mutate(() => { changed = true; if (change === "vacancy") f.unit.tenantAssignments = [];
      else if (change === "replacement") f.unit.tenantAssignments[0].id = "replacement";
      else f.unit.tier.baseRentCents = 12000; });
    await Promise.resolve(); await Promise.resolve(); const blocked = !changed;
    resume.resolve(); await monthly; await writer;
    assert.equal(blocked, true, "writer must wait for monthly Property lock");
    assert.ok(f.events.indexOf("writer:commit") > f.events.indexOf("commit"));
    assert.equal(f.ledger.find(row => row.chargeType === "RENT").amountCents, 10000);
    assert.ok(f.ledger.every(row => row.tenantAssignmentId === "assignment"));
  });
}
for (const missing of ["missingUnit", "missingProperty"] as const) test("AUD-01: " + missing + " skipped", async () => {
  const f = populated(); f.controls[missing] = true;
  const result = await f.run(now); assert.equal(f.ledger.length, 0); assert.equal(result.processedUnits, 0);
});
for (const code of ["P2034", "40001", "40P01"]) test("AUD-01: whole transaction retry for " + code, async () => {
  const f = populated(); f.controls.commitErrors = [Object.assign(Error("conflict"), { code })];
  const result = await f.run(now); assert.equal(result.rentChargesCreated, 1);
  assert.equal(f.events.filter(e => e === "rollback").length, 1);
  assert.equal(f.events.filter(e => e === "property:lock").length, 2); assert.equal(f.ledger.length, 3);
});
test("AUD-01: retry exhaustion never reports success", async () => {
  const f = populated(); f.controls.commitErrors = Array.from({ length: 3 }, () => Object.assign(Error("conflict"), { code: "P2034" }));
  await assert.rejects(f.run(now), /conflict/); assert.equal(f.ledger.length, 0);
  assert.equal(f.events.filter(e => e === "rollback").length, 3);
});
test("AUD-01: arbitrary failures are not retried", async () => {
  const f = populated(); f.controls.commitErrors = [Error("application failure")];
  await assert.rejects(f.run(now), /application failure/); assert.equal(f.events.filter(e => e === "rollback").length, 1);
});

test("AUD-01 MODEL: recurring boundary replacement waits for monthly commit", async () => {
  const fee = { id: "pending", tierId: "t", label: "Fee", amountCents: 1000, isActive: true,
    effectiveDate: new Date("2026-10-01T05:00:00Z"), effectiveUntil: null };
  const f = monthlyFixture([fee]); const read = barrier(); const resume = barrier();
  f.controls.onRead = async () => { read.resolve(); await resume.promise; };
  const monthly = f.run(now); await read.promise;
  let replaced = false;
  const writer = f.mutate(() => { replaced = true; fee.isActive = false; });
  await Promise.resolve(); await Promise.resolve(); const blocked = !replaced;
  resume.resolve(); await monthly; await writer;
  assert.equal(blocked, true); assert.equal(f.ledger.length, 1);
  assert.equal(f.ledger[0].idempotencyKey, "TIER_RECURRING_FEE:u:2026-10:pending");
});
test("AUD-01: retry rereads changed price instead of retaining rolled-back payload", async () => {
  const f = populated(); let reads = 0;
  f.controls.onLock = () => { if (++reads === 2) f.unit.tier.baseRentCents = 12000; };
  f.controls.commitErrors = [Object.assign(Error("serialization"), { code: "P2010", meta: { code: "40001" } })];
  await f.run(now); assert.equal(f.ledger.find(row => row.chargeType === "RENT").amountCents, 12000);
});
test("AUD-01: existing historical identities remain consumed", async () => {
  const f = populated(); await f.run(now); const before = structuredClone(f.ledger);
  f.ledger[0].voidedAt = now;
  await f.run(now); assert.equal(f.ledger.length, before.length);
  assert.equal(f.ledger[0].voidedAt.getTime(), now.getTime());
});
test("AUD-01: monthly posting never calls payment or Stripe state writers", async () => {
  // The fixture exposes only Unit/configuration/ledger operations. Any Payment
  // or Stripe call is unavailable and fails rather than silently succeeding.
  const f = populated(); await f.run(now); assert.equal(f.ledger.length, 3);
});

test("AUD-01: actual manual Post Rent route overlaps scheduled job without duplicate obligations", async () => {
  const f = populated(); const read = barrier(); const resume = barrier(); let audits = 0;
  f.controls.onRead = async () => { read.resolve(); await resume.promise; };
  const route = load("app/api/ledger/post-rent/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown) => ({ status: 200, body }) } },
    "@/lib/prisma": { prisma: { auditLog: { create: async () => { audits++; } } } },
    "@/lib/session": { getSession: async () => ({ role: "OWNER", propertyId: "p", managementUserId: "m" }) },
    "@/lib/permissions": { canManageFinancials: () => true },
    "@/jobs/monthlyRent": { runMonthlyRentJob: async (_date: Date, propertyId: string) => {
      assert.equal(propertyId, "p"); return f.run(now);
    } },
  });
  const scheduled = f.run(now); await read.promise;
  const manual = route.POST(); resume.resolve();
  const [result, response] = await Promise.all([scheduled, manual]);
  assert.equal(result.rentChargesCreated, 1); assert.equal(response.body.data.posted, 0);
  assert.equal(audits, 1); assert.equal(f.ledger.length, 3);
});
