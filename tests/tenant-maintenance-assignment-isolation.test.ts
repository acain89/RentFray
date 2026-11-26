import { recordRows, requiredRecord } from "./fixture-assertions";

import { test } from "node:test";
import assert from "node:assert/strict";
import { load, json, session } from "./tenant-payment-history-isolation.fixture";
import { maintenanceFixture } from "./tenant-maintenance-assignment-isolation.fixture";

test("tenant create persists server identity despite hostile body identity and preserves response", async () => {
  const f = maintenanceFixture(); const api = load("app/api/tenant/maintenance/create/route.ts", f.imports);
  const r = await api.POST({ json: async () => ({ category: " plumbing ", urgency: "high", description: " Leaking faucet ", propertyId: "q", unitId: "v", tenantAssignmentId: "a" }) });
  assert.equal(r.status, 200); assert.equal(f.writes[0].tenantAssignmentId, "b"); assert.equal(f.writes[0].propertyId, "p"); assert.equal(f.writes[0].unitId, "u");
  assert.equal(f.writes[0].status, "OPEN"); assert.equal(f.writes[0].urgency, "HIGH"); assert.equal(f.writes[0].createdByTenant, true);
  assert.deepEqual(Object.keys(requiredRecord(r.body.request)), ["id", "category", "urgency", "status", "description", "createdAt", "updatedAt"]);
  const listed = await load("app/api/tenant/maintenance/list/route.ts", f.imports).GET();
  assert.deepEqual(Array.from(recordRows(listed.body.requests), (row) => row.id), ["b", "new"]);
});
test("list excludes prior, null, cross-property and wrong-unit history without deleting", async () => {
  const f = maintenanceFixture(); const before = JSON.stringify(f.rows);
  const r = await load("app/api/tenant/maintenance/list/route.ts", f.imports).GET();
  assert.equal(r.status, 200); assert.deepEqual(Array.from(recordRows(r.body.requests), (row) => row.id), ["b"]);
  assert.equal(f.queries[0].where.tenantAssignmentId, "b"); assert.deepEqual(JSON.parse(JSON.stringify(f.queries[0].orderBy)), { createdAt: "desc" });
  assert.equal(JSON.stringify(f.rows), before);
});
for (const body of [{ category: "bad", urgency: "NORMAL", description: "valid text" }, { category: "GENERAL", urgency: "bad", description: "valid text" }, { category: "GENERAL", urgency: "NORMAL", description: "tiny" }])
  test("maintenance validation remains rejecting " + JSON.stringify(body), async () => {
    const f = maintenanceFixture(); assert.equal((await load("app/api/tenant/maintenance/create/route.ts", f.imports).POST({ json: async () => body })).status, 400); assert.equal(f.writes.length, 0);
  });
for (const route of ["create", "list"] as const) test("missing assignment denies maintenance " + route + " before DB", async () => {
  const api = load(`app/api/tenant/maintenance/${route}/route.ts`, { "next/server": json,
    "@/lib/session": { requireRole: async () => ({ ...session, tenantAssignmentId: undefined }) },
    "@/lib/prisma": { prisma: new Proxy({}, { get() { throw Error("Unexpected database access"); } }) } });
  assert.equal((await ("GET" in api ? api.GET() : api.POST({ json: async () => { throw Error("Unexpected parsing"); } }))).status, 401);
});
