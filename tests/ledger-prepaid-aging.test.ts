import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = resolve(__dirname, "..");
function load(file: string, imports: Record<string, unknown>, text = readFileSync(resolve(root, file), "utf8")) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(code, { module, exports: module.exports, Date, Intl,
    require(name: string) { assert.ok(name in imports, "Unexpected dependency: " + name); return imports[name]; } });
  return module.exports;
}
const dates = load("lib/rentDates.ts", {});
const instant = (day: string): Date => dates.getBusinessDateInstant(day);
const baseline = execFileSync("git", ["--no-optional-locks", "show", "HEAD:lib/ledger.ts"], { cwd: root, encoding: "utf8", windowsHide: true });
function row(amountCents: number, day: string, entryType = "CHARGE", extra: Record<string, unknown> = {}): any {
  return { unitId: "u", tenantAssignmentId: "a", amountCents, entryType, chargeType: "RENT", billingCycle: day.slice(0, 7),
    effectiveDate: instant(day), createdAt: instant(day), voidedAt: null, payment: null, ...extra };
}
function fixture(rows: any[]) {
  const entries = rows.map((entry, i) => ({ id: String(i).padStart(3, "0"), ...entry }));
  const queries: any[] = [];
  const matches = (entry: any, where: any): boolean => entry.unitId === where.unitId &&
    (!where.OR || where.OR.some((part: any) => entry.tenantAssignmentId === part.tenantAssignmentId));
  const prisma = {
    ledgerEntry: { findMany: async (query: any) => {
      queries.push(query);
      assert.equal(query.where.voidedAt, null);
      assert.deepEqual(JSON.parse(JSON.stringify(query.orderBy)), [{ effectiveDate: "asc" }, { createdAt: "asc" }, { id: "asc" }]);
      return entries.filter(entry => matches(entry, query.where) && entry.voidedAt === null && entry.effectiveDate <= query.where.effectiveDate.lte)
        .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    } },
    payment: { findMany: async ({ where }: any) => entries.filter(entry => entry.payment && matches(entry, where))
      .map(entry => ({ ...entry.payment, amountCents: Math.abs(entry.amountCents), billingCycle: entry.billingCycle })) },
  };
  const imports = { "@/lib/prisma": { prisma } };
  const current = readFileSync(resolve(root, "lib/ledger.ts"), "utf8").replace(/\r\n/g, "\n");
  // Observe the existing local buckets in memory without adding a production API.
  const anchor = "  return {\n    balanceCents,";
  assert.ok(current.includes(anchor));
  const observed = current.replace(anchor, "  return {\n    buckets: outstandingBuckets.filter(bucket => bucket.amountCents > 0),\n    balanceCents,");
  const ledger = load("lib/ledger.ts", imports, observed);
  const old = load("lib/ledger.ts", imports, baseline);
  const input = (extra: any = {}) => ({ unitId: "u", tenantAssignmentId: "a", asOf: instant("2026-11-02"), billingCycle: "2026-11", ...extra });
  return { queries, ledger, summary: (extra: any = {}) => ledger.getUnitLedgerSummary(input(extra)), old: (extra: any = {}) => old.getUnitLedgerSummary(input(extra)) };
}
function assertBuckets(summary: any, expected: Array<[string, number]>) {
  assert.deepEqual(Array.from(summary.buckets, (bucket: any) => [bucket.effectiveDate.toISOString(), bucket.amountCents]),
    expected.map(([day, amount]) => [instant(day).toISOString(), amount]));
  assert.equal(summary.buckets.reduce((sum: number, bucket: any) => sum + bucket.amountCents, 0), Math.max(0, summary.balanceCents));
  assert.equal(summary.oldestOutstandingDueDate?.toISOString() ?? null, expected.length ? instant(expected[0][0]).toISOString() : null);
}
const scenarios: Array<{ name: string; rows: any[]; balance: number; buckets: Array<[string, number]> }> = [
  { name: "future CREDIT excluded", rows: [row(100000, "2026-10-01"), row(-100000, "2026-11-03", "CREDIT")], balance: 100000, buckets: [["2026-10-01", 100000]] },
  { name: "future CHARGE excluded", rows: [row(-100000, "2026-09-01", "CREDIT"), row(100000, "2026-11-03")], balance: -100000, buckets: [] },
  { name: "current partial CREDIT", rows: [row(100000, "2026-10-01"), row(-50000, "2026-10-02", "CREDIT")], balance: 50000, buckets: [["2026-10-01", 50000]] },
  { name: "current exact CREDIT", rows: [row(100000, "2026-10-01"), row(-100000, "2026-10-02", "CREDIT")], balance: 0, buckets: [] },
  { name: "current excess CREDIT", rows: [row(100000, "2026-10-01"), row(-150000, "2026-10-02", "CREDIT")], balance: -50000, buckets: [] },
  { name: "excess credit offsets later rent", rows: [row(100000, "2026-10-01"), row(-150000, "2026-10-02", "CREDIT"), row(100000, "2026-11-01")], balance: 50000, buckets: [["2026-11-01", 50000]] },
  { name: "prepaid CREDIT before first obligation", rows: [row(-100000, "2026-09-01", "CREDIT"), row(100000, "2026-10-01")], balance: 0, buckets: [] },
  { name: "prepaid CREDIT spans later obligations", rows: [row(-150000, "2026-09-01", "CREDIT"), row(100000, "2026-10-01"), row(100000, "2026-11-01")], balance: 50000, buckets: [["2026-11-01", 50000]] },
  { name: "multiple prepaid credits", rows: [row(-30000, "2026-09-01", "CREDIT"), row(-20000, "2026-09-02", "CREDIT"), row(100000, "2026-10-01")], balance: 50000, buckets: [["2026-10-01", 50000]] },
  { name: "multiple obligations then partial credit FIFO", rows: [row(100000, "2026-10-01"), row(100000, "2026-11-01"), row(-150000, "2026-11-02", "CREDIT")], balance: 50000, buckets: [["2026-11-01", 50000]] },
  { name: "multiple obligations then excess credit", rows: [row(100000, "2026-10-01"), row(100000, "2026-11-01"), row(-250000, "2026-11-02", "CREDIT")], balance: -50000, buckets: [] },
  { name: "negative adjustment carries", rows: [row(-100000, "2026-09-01", "ADJUSTMENT"), row(100000, "2026-10-01"), row(100000, "2026-11-01")], balance: 100000, buckets: [["2026-11-01", 100000]] },
  { name: "PAID payment carries", rows: [row(-100000, "2026-09-01", "PAYMENT", { payment: { status: "PAID" } }), row(100000, "2026-10-01"), row(100000, "2026-11-01")], balance: 100000, buckets: [["2026-11-01", 100000]] },
  { name: "mixed reductions accumulate", rows: [row(-30000, "2026-09-01", "CREDIT"), row(-20000, "2026-09-02", "ADJUSTMENT"), row(-50000, "2026-09-03", "PAYMENT", { payment: { status: "PAID" } }), row(100000, "2026-10-01"), row(100000, "2026-11-01")], balance: 100000, buckets: [["2026-11-01", 100000]] },
  { name: "partial returned principal remains an obligation", rows: [row(-100000, "2026-09-01", "PAYMENT", { payment: { status: "PAID" } }), row(100000, "2026-10-01"), row(50000, "2026-11-01", "ADJUSTMENT")], balance: 50000, buckets: [["2026-11-01", 50000]] },
  { name: "voided CREDIT excluded", rows: [row(-100000, "2026-09-01", "CREDIT", { voidedAt: instant("2026-10-01") }), row(100000, "2026-10-01")], balance: 100000, buckets: [["2026-10-01", 100000]] },
  { name: "voided obligation excluded", rows: [row(-100000, "2026-09-01", "CREDIT"), row(100000, "2026-10-01", "CHARGE", { voidedAt: instant("2026-10-02") }), row(100000, "2026-11-01")], balance: 0, buckets: [] },
  { name: "foreign assignment reduction excluded", rows: [row(-100000, "2026-09-01", "CREDIT", { tenantAssignmentId: "other" }), row(100000, "2026-10-01")], balance: 100000, buckets: [["2026-10-01", 100000]] },
  { name: "foreign assignment obligation excluded", rows: [row(-100000, "2026-09-01", "CREDIT"), row(100000, "2026-10-01", "CHARGE", { tenantAssignmentId: "other" }), row(100000, "2026-11-01")], balance: 0, buckets: [] },
  { name: "legacy NULL assignment remains compatible", rows: [row(-100000, "2026-09-01", "CREDIT", { tenantAssignmentId: null }), row(100000, "2026-10-01"), row(100000, "2026-11-01", "CHARGE", { tenantAssignmentId: null })], balance: 100000, buckets: [["2026-11-01", 100000]] },
  { name: "foreign unit excluded", rows: [row(-100000, "2026-09-01", "CREDIT", { unitId: "other" }), row(100000, "2026-10-01")], balance: 100000, buckets: [["2026-10-01", 100000]] },
];
for (const status of ["UNPAID", "PENDING", "FAILED", "REVERSED"]) scenarios.push({ name: status + " payment does not reduce",
  rows: [row(-100000, "2026-09-01", "PAYMENT", { payment: { status } }), row(100000, "2026-10-01")], balance: 100000, buckets: [["2026-10-01", 100000]] });
for (const scenario of scenarios) test(scenario.name + ": bucket invariant and accounting unchanged", async () => {
  const f = fixture(scenario.rows); const summary = await f.summary(); const before = await f.old();
  assert.equal(summary.balanceCents, scenario.balance); assertBuckets(summary, scenario.buckets);
  for (const key of Object.keys(before).filter(key => !["priorCycleOutstandingCents", "priorCycleOutstanding", "oldestOutstandingDueDate"].includes(key))) {
    assert.deepEqual(JSON.parse(JSON.stringify(summary[key])), JSON.parse(JSON.stringify(before[key])), key);
  }
});

test("future reductions and charges enter allocation only at their effective instant", async () => {
  const f = fixture([row(-100000, "2026-09-01", "CREDIT"), row(100000, "2026-10-01"), row(100000, "2026-11-01"), row(-50000, "2026-11-03", "CREDIT"), row(25000, "2026-11-04")]);
  assertBuckets(await f.summary(), [["2026-11-01", 100000]]);
  assertBuckets(await f.summary({ asOf: new Date(instant("2026-11-03").getTime() - 1) }), [["2026-11-01", 100000]]);
  assertBuckets(await f.summary({ asOf: instant("2026-11-03") }), [["2026-11-01", 50000]]);
  assertBuckets(await f.summary({ asOf: instant("2026-11-04") }), [["2026-11-01", 50000], ["2026-11-04", 25000]]);
});

test("effectiveDate, createdAt and ID ordering remain deterministic", async () => {
  const day = "2026-10-01";
  const f = fixture([row(100000, day, "CHARGE", { id: "z", createdAt: new Date(instant(day).getTime() + 2), billingCycle: "2026-11" }),
    row(-150000, day, "CREDIT", { id: "c", createdAt: instant(day) }),
    row(100000, day, "CHARGE", { id: "b", createdAt: new Date(instant(day).getTime() + 1), billingCycle: "2026-10" }),
    row(100000, day, "CHARGE", { id: "a", createdAt: new Date(instant(day).getTime() + 1), billingCycle: "2026-09" })]);
  const summary = await f.summary();assert.equal(summary.balanceCents, 150000);
  assert.equal(summary.priorCycleOutstandingCents, 50000);
  assertBuckets(summary, [[day, 50000], [day, 100000]]);
});

test("prepaid September credit leaves November-only debt in GRACE and no false late-fee eligibility", async () => {
  const f = fixture([row(-100000, "2026-09-01", "CREDIT"), row(100000, "2026-10-01"), row(100000, "2026-11-01")]);
  const summary = await f.summary();assert.equal(summary.balanceCents, 100000);assertBuckets(summary, [["2026-11-01", 100000]]);
  assert.equal(summary.priorCycleOutstandingCents, 0);
  const financial = load("lib/unitFinancialState.ts", { "@/lib/ledger": f.ledger, "@/lib/rentDates": dates,
    "@/lib/unitStatusEngine": load("lib/unitStatusEngine.ts", {}), "@/lib/billingConfig": { getProcessingFeeCents: () => 0 },
    "@/lib/billingCalendar": { assertTierBillingCalendar: () => 1 } });
  const state = await financial.getUnitFinancialState({ propertyId: "p", unitId: "u", tenantAssignmentId: "a", now: instant("2026-11-02"),
    rentFrayStartDate: new Date("2026-01-01T00:00:00Z"), propertySettings: null, tier: { rentDueDay: 1, gracePeriodDays: 5 } });
  assert.equal(state.ledgerBalanceCents, 100000);assert.equal(state.status.status, "GRACE");
  assert.equal(state.isDelinquent, false);assert.equal(state.isPastGracePeriod, false);assert.equal(state.isWithinGracePeriod, true);assert.equal(state.daysPastDue, 0);
  assert.equal(state.ledgerSummary.oldestOutstandingDueDate.toISOString(), instant("2026-11-01").toISOString());
});
