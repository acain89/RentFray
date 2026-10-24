import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { spawnSync } from "node:child_process";

function compile(source: string) {
  return ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText;
}

test("audit refuses to fall back to the application database", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/audit-tier-active-unit-counts.ts"], {
    encoding: "utf8", timeout: 30000,
    env: { ...process.env, AUDIT_DATABASE_URL: "", DATABASE_URL: "must-never-be-used" },
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Tier counter audit failed/);
  assert.doesNotMatch(result.stderr, /must-never-be-used|PrismaClient/);
});

for (const failCounter of [false, true]) {
  test("scale seed keeps inventory and counter atomic; failure=" + failCounter, async () => {
    const units: Record<string, unknown>[] = [];
    let counter = 0, assignments = 0, locks = 0;
    const create = async ({ data }: { data: Record<string, unknown> }) => ({ id: "test", ...data });
    const db = {
      property: { findUnique: async () => null, create },
      managementUser: { create },
      propertyTier: {
        create,
        update: async ({ data }: { data: { activeUnitCount: number } }) => {
          if (failCounter) throw new Error("injected counter failure");
          counter = data.activeUnitCount;
        },
      },
      unit: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          units.push(data); return { id: String(units.length), ...data };
        },
        count: async ({ where }: { where: Record<string, unknown> }) =>
          units.filter(unit => Object.entries(where).every(([key, value]) => unit[key] === value)).length,
      },
      tenantAssignment: { create: async (args: { data: Record<string, unknown> }) => { assignments++; return create(args); } },
      unitRecurringFee: { createMany: async () => ({ count: 2 }) },
      ledgerEntry: { create, createMany: async () => ({ count: 3 }) },
      payment: { create },
      $queryRaw: async (sql: TemplateStringsArray) => { assert.match(sql.join("?"), /FROM "Property".*FOR UPDATE/); locks++; return []; },
    };
    const prisma = {
      ...db,
      $transaction: async (fn: (tx: typeof db) => Promise<unknown>): Promise<unknown> => {
        const length = units.length, saved = counter;
        try { return await fn(db); }
        catch (error) { units.splice(length); counter = saved; throw error; }
      },
    };
    const source = readFileSync("scripts/seed-scale-property.ts", "utf8");
    const invocation = source.lastIndexOf("\nmain()"); assert.ok(invocation > 0);
    const sandboxModule = { exports: {} as { run: () => Promise<void> } };
    const imports: Record<string, unknown> = {
      "@prisma/client": { PrismaClient: class { constructor() { return prisma; } },
        PaymentStatus: { PAID: "PAID", PENDING: "PENDING", FAILED: "FAILED" } },
      bcryptjs: { hash: async () => "test-hash" }, "../lib/pin": { hashPin: () => "test-pin" },
    };
    runInNewContext(compile(source.slice(0, invocation) + "\nmodule.exports.run = main;"), {
      module: sandboxModule, exports: sandboxModule.exports, Date, console: { log() {} },
      require(name: string) { assert.ok(name in imports); return imports[name]; },
    });
    if (failCounter) {
      await assert.rejects(sandboxModule.exports.run(), /injected counter failure/);
      assert.equal(units.length, 0); assert.equal(counter, 0); assert.equal(assignments, 0);
    } else {
      await sandboxModule.exports.run();
      assert.equal(units.length, 200); assert.equal(counter, 200);
      assert.equal(assignments, 200); assert.equal(locks, 200);
    }
  });
}

test("dashboard tier output derives inventory counts even with stale stored values", () => {
  const source = readFileSync("app/api/manager/dashboard/route.ts", "utf8");
  const countStart = source.indexOf("const activeUnitCountsByTier =");
  const countEnd = source.indexOf("const now =", countStart);
  const mapStart = source.indexOf("tiers.map((tier:");
  const mapEnd = source.indexOf("}),", mapStart) + 2;
  assert.ok(countStart > 0 && countEnd > countStart && mapStart > countEnd && mapEnd > mapStart);
  const sandboxModule = { exports: [] as { activeUnitCount: number; availableUnitCount: number }[] };
  runInNewContext(compile(source.slice(countStart, countEnd) + "\nmodule.exports = " + source.slice(mapStart, mapEnd) + ";"), {
    module: sandboxModule, units: [{ tierId: "a" }, { tierId: "a" }, { tierId: "b" }, { tierId: null }],
    tiers: [{ id: "a", unitCount: 3, activeUnitCount: 99 }, { id: "b", unitCount: 1, activeUnitCount: 0 }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(sandboxModule.exports.map(tier => [tier.activeUnitCount, tier.availableUnitCount]))), [[2, 1], [1, 0]]);
});
