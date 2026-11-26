import { isRecord } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { pageFile, detailFixture, nodes, textOf } from "./manager-unit-detail-financial-consistency.fixture";

for (const status of ["PENDING", "FAILED", "PAID", "GRACE", "PAST_DUE"]) test(`detail consumes canonical ${status}`, async () => {
  const f = detailFixture(status); const text = textOf(await f.render());
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].tenantAssignmentId, "b");
  assert.equal(f.calls[0].propertyId, "p"); assert.equal(f.calls[0].unitId, "u");
  assert.match(text, /\$123\.45/); assert.match(text, /\$234\.56/); assert.match(text, /\$111\.11/);
  assert.ok(text.includes(`Canonical ${status}`)); assert.ok(text.includes(`Authority ${status}`));
  assert.ok(text.includes("47")); assert.ok(text.includes("10/1/2026")); assert.ok(text.includes("10/3/2026"));
  assert.ok(text.includes("Already posted")); assert.ok(text.includes("\$7.00"));
  if (status === "PENDING") assert.ok(text.includes("\$0.00"));
  assert.ok(!text.includes("Eligible to post late fee")); assert.ok(!text.includes("based on current delinquency timing"));
});
test("vacancy and STAFF read/mutation boundaries preserved", async () => {
  const f = detailFixture("PAID", "STAFF"); const tree = await f.render();
  assert.equal(nodes(tree).filter(n => isRecord(n) && f.controls.some(control => control === n.type)).length, 0);
  f.unit.tenantAssignments = []; const text = textOf(await f.render()); assert.match(text, /VACANT/);
  assert.equal(f.calls.length, 1); assert.ok(!text.includes("\$123.45"));
});
test("no competing status, balance or late-fee calculator", () => {
  const source = readFileSync(pageFile, "utf8");
  for (const forbidden of ["resolveStatus", "getUnitDelinquencySummary", "getUnitLedgerSummary", "recommendedLateFeeCents", "runningBalanceCents"]) assert.ok(!source.includes(forbidden), forbidden);
  assert.ok(source.includes("getUnitFinancialState")); assert.ok(source.includes("applied automatically"));
});

test("real canonical financial authority preserves null accounting and prior-cycle FIFO aging", async () => {
  type Modules = {
    "lib/ledger.ts": typeof import("../lib/ledger");
    "lib/rentDates.ts": typeof import("../lib/rentDates");
    "lib/unitStatusEngine.ts": typeof import("../lib/unitStatusEngine");
    "lib/unitFinancialState.ts": typeof import("../lib/unitFinancialState");
  };
  function load<File extends keyof Modules>(file: File, imports: Record<string, unknown>): Modules[File];
  function load(file: keyof Modules, imports: Record<string, unknown>): unknown {
    const fixtureModule: { exports: unknown } = { exports: {} };
    runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    } }).outputText, { module: fixtureModule, exports: fixtureModule.exports, Date, Intl,
      require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
    assert.ok(isRecord(fixtureModule.exports)); return fixtureModule.exports;
  }
  const ledger = load("lib/ledger.ts", { "@/lib/prisma": { prisma: {
    ledgerEntry: { findMany: async ({ where }: { where: { unitId: string; OR: { tenantAssignmentId: string | null }[] } }) => {
      assert.equal(where.unitId, "u"); assert.equal(where.OR[0].tenantAssignmentId, "b");
      assert.equal(where.OR[1].tenantAssignmentId, null);
      return [{ id: "current", amountCents: 10000, entryType: "CHARGE", chargeType: "RENT",
        billingCycle: "2026-09", effectiveDate: new Date("2026-09-01"), createdAt: new Date("2026-09-01"), payment: null },
      { id: "unassigned", amountCents: 700, entryType: "CHARGE", chargeType: "LATE_FEE",
        billingCycle: "2026-09", effectiveDate: new Date("2026-09-03"), createdAt: new Date("2026-09-03"), payment: null }];
    } }, payment: { findMany: async () => [] },
  } } });
  const dates = load("lib/rentDates.ts", {});
  const status = load("lib/unitStatusEngine.ts", {});
  const canonical = load("lib/unitFinancialState.ts", {
    "@/lib/ledger": ledger, "@/lib/rentDates": dates, "@/lib/unitStatusEngine": status,
    "@/lib/billingConfig": { getProcessingFeeCents: () => 0 },
    "@/lib/billingCalendar": { assertTierBillingCalendar: () => 1 },
  });
  const results: Awaited<ReturnType<typeof canonical.getUnitFinancialState>>[] = [];
  const f = detailFixture("PAID", "OWNER", async input => {
    const result = await canonical.getUnitFinancialState({ ...input, now: new Date("2026-10-05T18:00:00Z") }); results.push(result); return result;
  });
  f.unit.tier = { rentDueDay: 1, gracePeriodDays: 2, lateFeeInitialCents: 700, lateFeeDailyCents: 200, maxLateFeeDays: 10 };
  f.unit.property.rentFrayStartDate = new Date("2026-01-01T18:00:00Z");
  const text = textOf(await f.render()); const result = results[0]; assert.ok(result); assert.equal(result.ledgerBalanceCents, 10700);
  assert.equal(result.status.status, "PAST_DUE"); assert.ok(result.daysPastDue > 30);
  assert.ok(text.includes("$107.00")); assert.ok(text.includes(String(result.daysPastDue)));
  assert.ok(text.includes(result.status.label));
});
