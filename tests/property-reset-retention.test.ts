import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load, root } from "./unit-deletion-retention.test";
function fixture(role: string | null = "ADMIN") {
  const mutations: string[] = []; let reads = 0;
  const property = { id: "a", name: "Property", propertyCode: "CODE", status: "LIVE", units: [], paymentStatus: null };
  const prisma: any = {
    property: { findUnique: async () => { reads++; return property; }, update: async ({ data }: any) => { mutations.push("property"); return { ...property, ...data }; } },
    unit: { findFirst: async () => ({ id: "unit", unitNumber: "101" }), update: async () => { mutations.push("unit"); } },
    tenantAssignment: { updateMany: async () => { mutations.push("tenantAssignment"); } },
    auditLog: { create: async () => { mutations.push("auditLog"); } },
    paymentConnectionStatus: { upsert: async ({ create }: any) => { mutations.push("paymentConnectionStatus"); return { id: "connection", ...create }; } },
    $transaction: async (fn: any) => fn(prisma),
  };
  for (const model of ["ledgerEntry", "payment", "maintenanceRequest"])
    prisma[model] = new Proxy({}, { get() { throw Error("Forbidden mutation/access: " + model); } });
  const api = load("app/api/admin/properties/[id]/override/route.ts", {
    "@/lib/prisma": { prisma }, "@/lib/session": { getSession: async () => role ? { role } : null },
    "next/server": { NextResponse: { json: (body: any, options?: any) => ({ body, status: options?.status ?? 200 }) } },
  });
  return { mutations, reads: () => reads, call: (action: string) => api.POST({ json: async () => ({ action, unitId: "unit", reason: "isolated" }) }, { params: Promise.resolve({ id: "a" }) }) };
}
test("reset: ADMIN receives 410 without any application data reads or mutations", async () => {
  const f = fixture(); const response = await f.call("RESET_PROPERTY"); assert.equal(response.status, 410);
  assert.match(response.body.error, /retired/); assert.equal(f.reads(), 0); assert.equal(f.mutations.length, 0);
});
for (const role of [null, "OWNER", "MANAGER", "STAFF", "TENANT", "MAINTENANCE"])
  test("reset: preserves ADMIN guard " + role, async () => { const f = fixture(role); assert.equal((await f.call("RESET_PROPERTY")).status, 401); assert.equal(f.mutations.length, 0); });
for (const [action, expected] of [["FORCE_LIVE", ["property", "auditLog"]],
  ["UNLOCK_UNIT", ["tenantAssignment", "unit", "auditLog"]], ["REPAIR_PAYMENT_STATUS", ["paymentConnectionStatus", "auditLog"]]] as [string, string[]][])
  test("override: unchanged operation " + action, async () => { const f = fixture(); const response = await f.call(action);
    assert.equal(response.status, 200); assert.equal(response.body.ok, true); assert.equal(response.body.action, action);
    assert.deepEqual(f.mutations, expected); if (action === "FORCE_LIVE") assert.equal(response.body.property.status, "LIVE"); });
test("reset: UI has no control, success branch or replacement reset", () => {
  const source = readFileSync(resolve(root, "app/admin/properties/[id]/setup/page.tsx"), "utf8");
  assert.ok(!source.includes("RESET_PROPERTY")); assert.ok(!source.includes("Reset Property"));
  for (const action of ["FORCE_LIVE", "UNLOCK_UNIT", "REPAIR_PAYMENT_STATUS"]) assert.ok(source.includes(action));
});
