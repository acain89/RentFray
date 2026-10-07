import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { source, response, root, context } from "./required-audit-atomicity.test";

const file = "app/api/admin/properties/[id]/setup/route.ts";
const pageFile = "app/admin/properties/[id]/setup/page.tsx";
function fixture(role: string | null, missing = false) {
  let reads = 0, parsed = 0;
  const record: any = { id: "p", name: "Property", propertyCode: "1234", status: "SETUP", stripeAccountId: "secret-account",
    rentFrayStartDate: "locked", settings: { baseRentDefault: "obsolete" }, passwordHash: "secret", tokenHash: "secret",
    units: [{ id: "u", unitNumber: "101", tierId: "t", isActive: true, portalActivated: true, tenantPinHash: "secret", pinHash: "secret" }] };
  function project(row: any, select: any): any { const result: any = {}; for (const [key, value] of Object.entries(select)) {
    if (value === true) result[key] = row[key]; else result[key] = row[key].map((item: any) => project(item, (value as any).select));
  } return result; }
  const blocked = new Proxy({}, { get() { throw Error("Unexpected database mutation/model"); } });
  const api = source(file, { "next/server": response, "@/lib/session": { getSession: async () => role ? { role } : null },
    "@/lib/prisma": { prisma: new Proxy({ property: { findUnique: async ({ where, select }: any) => {
      reads++; assert.equal(where.id, "p"); assert.ok(select); assert.equal(select.units.orderBy.unitNumber, "asc");
      assert.deepEqual(Object.keys(select).sort(), ["id", "name", "propertyCode", "status", "units"]);
      assert.deepEqual(Object.keys(select.units.select).sort(), ["id", "isActive", "portalActivated", "tierId", "unitNumber"]);
      return missing ? null : project(record, select);
    } } }, { get(target: any, key: string) { return key === "property" ? target.property : blocked; } }) } });
  return { api, reads: () => reads, request: { json: async () => { parsed++; throw Error("Must not parse"); } }, parsed: () => parsed };
}
for (const role of [null, "OWNER", "MANAGER", "STAFF", "TENANT", "MAINTENANCE"]) for (const method of ["GET", "POST"]) {
  test("ADMIN setup " + method + " retains authorization " + role, async () => {
    const f = fixture(role); assert.equal((await f.api[method](f.request, context)).status, 401); assert.equal(f.reads(), 0); assert.equal(f.parsed(), 0);
  });
}
test("ADMIN setup GET uses current non-secret projection and existing envelope", async () => {
  const f = fixture("ADMIN"); const result = await f.api.GET(f.request, context); assert.equal(result.status, 200); assert.equal(result.body.ok, true);
  assert.equal(result.body.property.propertyCode, "1234"); assert.equal(result.body.property.units[0].unitNumber, "101");
  for (const secret of ["tenantPinHash", "passwordHash", "pinHash", "tokenHash", "secret-account", "baseRentDefault"])
    assert.ok(!JSON.stringify(result.body).includes(secret), secret);
  assert.equal(f.reads(), 1);
});
test("ADMIN setup GET preserves missing-property response", async () => {
  const f = fixture("ADMIN", true); assert.equal((await f.api.GET(f.request, context)).status, 404);
});
test("ADMIN setup POST retires without parsing malformed/stale body or accessing database", async () => {
  const f = fixture("ADMIN"); const result = await f.api.POST(f.request, context);
  assert.equal(result.status, 410); assert.match(result.body.error, /retired/i); assert.equal(f.reads(), 0); assert.equal(f.parsed(), 0);
});
test("ADMIN page removes stale editors while retaining diagnostics and canonical payloads", () => {
  const now = readFileSync(resolve(root, pageFile), "utf8").replace(/\r\n/g, "\n");
  const before = execFileSync("git", ["--no-optional-locks", "show", "eda6c70dafc95079b2757d7ed5139ee03a225e5c:" + pageFile], { cwd: root, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
  for (const obsolete of ["baseRentDefault", "convenienceFee", "unitStart", "unitEnd", "saveSetup", "Save Setup", "Create Units", "Recurring Fees", "paymentNotes", "savePaymentStatus", "property.code"])
    assert.ok(!now.includes(obsolete), obsolete);
  for (const current of ["property.propertyCode", "Existing Units", "Live Readiness", "Save Lifecycle Status", "FORCE_LIVE", "UNLOCK_UNIT", "REPAIR_PAYMENT_STATUS"])
    assert.ok(now.includes(current), current);
  for (const [start, end] of [["  async function saveLifecycle()", "  async function runOverride"], ["  async function runOverride", "  if (loading"]])
    assert.equal(now.slice(now.indexOf(start), now.indexOf(end)), before.slice(before.indexOf(start), before.indexOf(end)));
  assert.ok(!now.includes("rentFrayStartDate")); assert.ok(!now.includes("lockBillingCalendar"));
});
