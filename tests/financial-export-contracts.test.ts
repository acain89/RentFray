import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, type Reply } from "./financial-export-contracts.fixture";

function rows(reply: Reply): Record<string, string>[] {
  assert.equal(reply.status, 200);
  assert.ok(typeof reply.body === "string", "Successful exports return CSV text");
  const [header, ...lines] = reply.body.split("\n"); if (!header) return [];
  const keys = header.split(",");
  return lines.map((line: string) => Object.fromEntries(line.split(",").map((value: string, i: number) => [keys[i], value])));
}
for (const alias of ["month", "billingCycle", "cycle"]) test(`balances ${alias}: unit search, multiple assignments and distinct totals`, async () => {
  const f = fixture(); f.entry("CHARGE", 1000);
  f.entry("CHARGE", 100000, { tenantAssignmentId: "a", tenantAssignment: { firstName: "Old", lastName: "Tenant" } });
  f.entry("CHARGE", 9000, { billingCycle: "2026-09" });
  f.entry("CHARGE", 7777, { effectiveDate: new Date("2026-10-31T05:00:00Z") });
  const result = rows(await f.get("balances", `${alias}=2026-10&unit=101`));
  assert.equal(result.length, 1); assert.equal(result[0].billingCycle, "2026-10");
  assert.equal(result[0].periodChargesCents, "101000"); assert.equal(result[0].currentBalanceCents, "10000");
  assert.equal(result[0].tenantName, "Current 101");
  const period = f.queries.find(q => q.include?.payment); assert.ok(period); assert.ok(period.include?.payment); assert.ok(period.where.effectiveDate); assert.equal(period.where.tenantAssignmentId, undefined);
  assert.equal(period.include.payment.select.status, true); assert.ok(period.where.effectiveDate.lte);
});
for (const status of ["PAID", "PENDING", "FAILED", "REVERSED"] as const) test(`period ${status}, credits and signed adjustments; real canonical current state`, async () => {
  const f = fixture(); f.entry("CHARGE", 100000); f.payment(status, { amountCents: 100000 });
  f.entry("CREDIT", 500); f.entry("ADJUSTMENT", -200); f.entry("ADJUSTMENT", 100); f.entry("CHARGE", 99999, { voidedAt: new Date() });
  const row = rows(await f.get("balances", "month=2026-10&unit=101"))[0];
  assert.equal(row.periodPaidCents, status === "PAID" ? "100000" : "0");
  assert.equal(row.periodCreditsCents, "500"); assert.equal(row.periodAdjustmentsCents, "-100");
  assert.equal(Number(row.periodNetCents), 100000 - (status === "PAID" ? 100000 : 0) - 600);
  const state = f.states[0].state; assert.equal(Number(row.currentBalanceCents), state.ledgerBalanceCents);
  assert.equal(row.currentStatus, state.status.status); assert.equal(row.isDelinquent, state.isDelinquent ? "YES" : "NO");
  assert.equal(row.currentPending, state.hasPendingPayment ? "YES" : "NO");
  assert.equal(Number(row.amountDueNowCents), status === "PENDING" ? 0 : state.ledgerBalanceCents);
});
test("canonical grace, prepaid credit and prior-cycle aging", async () => {
  const f = fixture(); f.units[0].tier.gracePeriodDays = 10; f.units[0].property.settings.gracePeriodDays = 10;
  f.entry("CHARGE", 1000);
  let row = rows(await f.get("balances", "unit=101"))[0]; assert.equal(row.currentGrace, "YES");
  f.entry("CREDIT", 2000); row = rows(await f.get("balances", "unit=101"))[0]; assert.equal(row.currentBalanceCents, "0"); assert.equal(row.currentStatus, "PAID");
  const prior = fixture(); prior.entry("CHARGE", 1000, { billingCycle: "2026-09", effectiveDate: new Date("2026-09-01T05:00:00Z") });
  row = rows(await prior.get("balances", "unit=101"))[0]; assert.equal(row.isDelinquent, "YES"); assert.ok(Number(row.daysPastDue) > 30);
});
test("vacancy retains historical unit-period totals, no current financial attribution", async () => {
  const f = fixture(); f.entry("CHARGE", 1000, { tenantAssignmentId: "a" }); f.units[0].tenantAssignments = [];
  const row = rows(await f.get("balances", "month=2026-10&unit=101"))[0];
  assert.equal(row.occupancyStatus, "VACANT"); assert.equal(row.tenantName, ""); assert.equal(row.currentBalanceCents, "0");
  assert.equal(row.currentStatus, "VACANT"); assert.equal(row.periodNetCents, "1000"); assert.equal(f.states.length, 0);
});
for (const route of ["ledger", "payments"] as const) {
  test(`${route} exact unit and search intersection, historical and NULL attribution`, async () => {
    const f = fixture(); f.payment("PAID", { tenantAssignmentId: "a", tenantAssignment: { firstName: "Old", lastName: "Tenant" } });
    f.payment("PAID", { tenantAssignmentId: null, tenantAssignment: null });
    f.payment("PAID", { unitId: "u2", unit: f.units[1] }); f.payment("PAID", { propertyId: "q", unitId: "foreign", unit: f.units[2] });
    const result = rows(await f.get(route, "unitId=u1")); assert.equal(result.length, 2);
    assert.equal(result[0].tenantName, "Old Tenant"); assert.equal(result[1].tenantName, ""); assert.ok(result.every(r => r.unitNumber === "101"));
    assert.equal(rows(await f.get(route, "unitId=u1&unit=102")).length, 0);
    assert.equal(rows(await f.get(route, "unit=102")).length, 1);
  });
  for (const id of ["foreign", "missing", ""]) test(`${route} invalid exact unit=${id} never falls back`, async () => {
    const f = fixture(); f.payment("PAID"); assert.equal((await f.get(route, `unitId=${id}`)).status, 404);
    assert.ok(!f.queries.some(q => q.model === "ledger" || q.model === "payment"));
  });
}
for (const route of ["balances", "ledger", "payments"] as const) {
  for (const role of ["OWNER", "MANAGER", "STAFF"] as const) test(`${route} RF-15 bound ${role} read access and revocation`, async () => {
    const f = fixture(role); f.entry("CHARGE", 1000); assert.equal((await f.get(route)).status, 200);
    f.management.passwordHash = "replacement"; const before = f.queries.length;
    assert.equal((await f.get(route)).status, 401); assert.equal(f.queries.length, before);
  });
  for (const role of [null, "TENANT", "MAINTENANCE", "ADMIN"] as const) test(`${route} rejects ${role ?? "missing"} before export queries`, async () => {
    const f = fixture(role); assert.equal((await f.get(route)).status, 401); assert.equal(f.queries.length, 0);
  });
  test(`${route} rejects property override and malformed period`, async () => {
    const f = fixture(); assert.equal((await f.get(route, "propertyId=q")).status, 403);
    assert.equal((await f.get(route, "month=bad")).status, 400); assert.equal(f.queries.length, 0);
  });
  test(`${route} read-only and existing CSV formatter retained`, () => {
    const source = readFileSync(`app/api/exports/${route}/route.ts`, "utf8");
    assert.ok(!/prisma\.\w+\.(create|update|delete|upsert)/.test(source));
    assert.ok(source.includes('str.replace(/"/g, \'""\')')); assert.ok(source.includes('"Cache-Control": "no-store"'));
  });
}
