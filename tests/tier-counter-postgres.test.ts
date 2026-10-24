import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { fixture, load } from "./manual-payment-idempotency.test";
import { fixture as adminFixture, request } from "./management-role-authorization.test";

// Opt-in only: never use DATABASE_URL or load application environment files.
// Prepare a fresh cluster with the existing migrations, then set this URL.
const url = process.env.TIER_COUNTER_TEST_DATABASE_URL;
type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

test("isolated PostgreSQL tier counter regressions", { skip: !url }, async (t) => {
  const target = new URL(url!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55439");
  assert.equal(target.username, "tier_test");
  assert.equal(target.pathname, "/rentfray_tier_counter_test");
  const db = new PrismaClient({ datasources: { db: { url } }, log: [] });
  const propertyIds: string[] = [];
  try {
    const identity = await db.$queryRaw<{ directory: string; database: string }[]>`
      SELECT current_setting('data_directory') AS directory, current_database() AS database`;
    assert.match(identity[0].directory.replaceAll("\\", "/"), /\/rentfray-tier-counter-test-20261023$/);
    assert.equal(identity[0].database, "rentfray_tier_counter_test");

    async function setup(capacity = 4) {
      const property = await db.property.create({ data: {
        name: "Isolated tier test", propertyCode: String(7000 + propertyIds.length),
        rentFrayStartDate: new Date("2026-01-01"),
        tiers: { create: [
          { name: "Source", unitCount: capacity, activeUnitCount: 77, baseRentCents: 10000 },
          { name: "Destination", unitCount: capacity, activeUnitCount: 88, baseRentCents: 20000 },
        ] },
      }, include: { tiers: { orderBy: { name: "desc" } } } });
      propertyIds.push(property.id);
      const f = fixture();
      f.imports["@prisma/client"] = { Prisma };
      f.imports["@/lib/prisma"] = { prisma: db };
      const route = () => load("app/api/tenant/activate/route.ts", f.imports);
      const activate = (tierId = property.tiers[0].id, unitNumber = "1") => route().POST({ json: async () => ({
        propertyCode: property.propertyCode, firstName: "Test", lastName: "Tenant",
        unitNumber, confirmUnitNumber: unitNumber, tierId, pin: "1234", confirmPin: "1234", recentMoveIn: false,
      }) });
      return { property, f, activate };
    }

    for (const source of ["new", "same", "cross", "null"] as const) {
      await t.test("activation recounts " + source + " and preserves rent", async () => {
        const { property, activate } = await setup();
        const [selected, previous] = property.tiers;
        if (source !== "new") await db.unit.create({ data: {
          propertyId: property.id, unitNumber: "1",
          tierId: source === "null" ? null : source === "cross" ? previous.id : selected.id,
        } });
        await db.unit.create({ data: { propertyId: property.id, unitNumber: "inactive", tierId: selected.id, isActive: false } });
        assert.equal((await activate()).status, 200);
        assert.equal((await db.propertyTier.findUniqueOrThrow({ where: { id: selected.id } })).activeUnitCount, 1);
        assert.equal((await db.propertyTier.findUniqueOrThrow({ where: { id: previous.id } })).activeUnitCount, source === "cross" ? 0 : 88);
        assert.equal(await db.tenantAssignment.count({ where: { propertyId: property.id, isCurrent: true } }), 1);
        const rent = await db.ledgerEntry.findMany({ where: { propertyId: property.id } });
        assert.equal(rent.length, 1); assert.equal(rent[0].amountCents, 10000);
      });
    }

    await t.test("assignment failure rolls back unit movement and both counter writes", async () => {
      const { property, f, activate } = await setup();
      const unit = await db.unit.create({ data: { propertyId: property.id, tierId: property.tiers[1].id, unitNumber: "1" } });
      f.imports["@/lib/prisma"].prisma = {
        $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>, options: TransactionOptions) =>
          db.$transaction(tx => fn(new Proxy(tx, { get(target, key) {
            if (key === "tenantAssignment") return { create: async () => { throw new Error("injected assignment failure"); } };
            return Reflect.get(target, key);
          } })), options),
      };
      assert.equal((await activate()).status, 500);
      assert.equal((await db.unit.findUniqueOrThrow({ where: { id: unit.id } })).tierId, property.tiers[1].id);
      for (const tier of property.tiers) assert.equal((await db.propertyTier.findUniqueOrThrow({ where: { id: tier.id } })).activeUnitCount, tier.activeUnitCount);
      assert.equal(await db.tenantAssignment.count({ where: { propertyId: property.id } }), 0);
      assert.equal(await db.ledgerEntry.count({ where: { propertyId: property.id } }), 0);
    });

    await t.test("two real transactions compete for final slot and retry safely", async () => {
      const { property, f, activate } = await setup(1);
      let release!: () => void; let attempted!: () => void; let locked!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const secondAttempt = new Promise<void>(resolve => { attempted = resolve; });
      const firstLock = new Promise<void>(resolve => { locked = resolve; });
      let calls = 0;
      f.imports["@/lib/prisma"].prisma = {
        $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>, options: TransactionOptions) =>
          db.$transaction(tx => fn(new Proxy(tx, { get(target, key) {
            if (key === "$queryRaw") return async (sql: TemplateStringsArray, ...values: unknown[]) => {
              const ordinal = ++calls;
              if (ordinal === 2) attempted();
              const result = await target.$queryRaw(sql, ...values);
              if (ordinal === 1) { locked(); await gate; }
              return result;
            };
            return Reflect.get(target, key);
          } })), { ...options, timeout: 20000 }),
      };
      const first = activate();
      await firstLock;
      const second = activate(property.tiers[0].id, "2");
      try { await secondAttempt; } finally { release(); }
      const results = await Promise.all([first, second]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      assert.equal(await db.unit.count({ where: { propertyId: property.id, isActive: true } }), 1);
      assert.equal((await db.propertyTier.findUniqueOrThrow({ where: { id: property.tiers[0].id } })).activeUnitCount, 1);
    });

    await t.test("property provisioning commits independent counts for multiple tiers", async () => {
      const f = adminFixture("ADMIN");
      f.imports["@/lib/prisma"] = { prisma: db };
      f.imports["@prisma/client"] = { Prisma };
      const result = await load("app/api/admin/properties/route.ts", f.imports).POST(request({
        account: { fullName: "Test Owner", email: "test@example.invalid", password: "password123" },
        property: { name: "Isolated provisioning", address: "Test address" },
        tiers: [{ name: "First", unitLabels: "a,b", baseRent: 100, dueDay: 1 }, { name: "Second", unitLabels: "c", baseRent: 200, dueDay: 1 }],
      }));
      assert.equal(result.status, 200);
      const id = result.body.property.id as string; propertyIds.push(id);
      const tiers = await db.propertyTier.findMany({ where: { propertyId: id }, orderBy: { name: "asc" } });
      assert.deepEqual(tiers.map(tier => [tier.unitCount, tier.activeUnitCount]), [[2, 2], [1, 1]]);
      assert.equal(await db.ledgerEntry.count({ where: { propertyId: id } }), 0);
    });

    await t.test("audit includes inactive/empty tiers and overruns without writes", async () => {
      const { property } = await setup();
      const tier = await db.propertyTier.create({ data: {
        propertyId: property.id, name: "Inactive overrun", isActive: false, unitCount: 0, activeUnitCount: 0,
      } });
      await db.unit.create({ data: { propertyId: property.id, tierId: tier.id, unitNumber: "overrun" } });
      const before = await db.propertyTier.findMany({ orderBy: { id: "asc" } });
      const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/audit-tier-active-unit-counts.ts"], {
        encoding: "utf8", env: { ...process.env, DATABASE_URL: "", AUDIT_DATABASE_URL: url }, timeout: 30000,
      });
      assert.equal(result.status, 1, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.tiersChecked, before.length);
      assert.ok(report.findings.some((row: { tierId: string; actualCount: number }) => row.tierId === property.tiers[0].id && row.actualCount === 0));
      assert.ok(report.findings.some((row: { tierId: string; tierIsActive: boolean; capacityOverrun: boolean }) => row.tierId === tier.id && !row.tierIsActive && row.capacityOverrun));
      assert.deepEqual(await db.propertyTier.findMany({ orderBy: { id: "asc" } }), before);
    });
  } finally {
    for (const id of propertyIds) await db.property.delete({ where: { id } });
    await db.$disconnect();
  }
});
