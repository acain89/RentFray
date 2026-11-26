import { recordRows, requiredValue } from "./fixture-assertions";

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { load, session } from "./tenant-payment-history-isolation.fixture";
import { maintenanceFixture } from "./tenant-maintenance-assignment-isolation.fixture";

test("real B4a session rejects vacancy, replacement, malformed binding and stale cookie", async () => {
  const rows: Record<string, { propertyId: string; unitId: string; isCurrent: boolean; moveOutDate: Date | null; unit: { id: string; propertyId: string } }> = { a: { propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, unit: { id: "u", propertyId: "p" } },
    b: { propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, unit: { id: "u", propertyId: "p" } } };
  let token = "";
  const authority = load("lib/session.ts", { crypto, "next/headers": { cookies: async () => ({ get: () => ({ value: token }), set() {} }) },
    "@/lib/prisma": { prisma: { tenantAssignment: { findUnique: async ({ where }: { where: { id: string } }) => rows[where.id] ?? null } } } });
  token = authority.createSessionToken({ ...session, tenantAssignmentId: "a" }); const old = token;
  assert.equal(requiredValue(await authority.getSession()).tenantAssignmentId, "a");
  const f = maintenanceFixture(); f.imports["@/lib/session"] = authority;
  assert.deepEqual(Array.from(recordRows((await load("app/api/tenant/maintenance/list/route.ts", f.imports).GET()).body.requests), (r) => r.id), ["a"]);
  rows.a.isCurrent = false; rows.a.moveOutDate = new Date(0);
  assert.equal(await authority.getSession(), null); assert.equal(f.rows.some(row => row.id === "a"), true);
  token = authority.createSessionToken(session);
  assert.deepEqual(Array.from(recordRows((await load("app/api/tenant/maintenance/list/route.ts", f.imports).GET()).body.requests), (r) => r.id), ["b"]);
  token = old; assert.equal(await authority.getSession(), null);
  for (const changes of [{ propertyId: "q" }, { unitId: "v" }]) {
    token = authority.createSessionToken({ ...session, ...changes }); assert.equal(await authority.getSession(), null);
  }
  const payload = Buffer.from(JSON.stringify({ role: "TENANT", propertyId: "p", unitId: "u", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+100 })).toString("base64url");
  token = payload + "." + crypto.createHmac("sha256", "synthetic-isolated-history-session-secret-key").update(payload).digest("base64url");
  assert.equal(await authority.getSession(), null);
});
for (const role of ["OWNER", "MANAGER", "STAFF", "MAINTENANCE"]) test("operational history retained for " + role, async () => {
  const f = maintenanceFixture({ ...session, role });
  const api = load("app/api/manager/maintenance/route.ts", f.imports);
  const result = await api.GET(); assert.equal(result.status, 200);
  assert.deepEqual(Array.from(recordRows(result.body.requests), (r) => r.id), ["a", "b", "null", "wrong-unit"]);
  if (role === "MAINTENANCE") {
    const worker = await load("app/api/maintenance/dashboard/route.ts", f.imports).GET();
    assert.deepEqual(Array.from(recordRows(worker.body.requests), (r) => r.id), ["a", "b", "null", "wrong-unit"]);
  }
});
