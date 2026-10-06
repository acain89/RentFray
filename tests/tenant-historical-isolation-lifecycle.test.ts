import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { load, json, session } from "./tenant-payment-history-isolation.test";
import { maintenanceFixture } from "./tenant-maintenance-assignment-isolation.test";

test("real B4a session rejects vacancy, replacement, malformed binding and stale cookie", async () => {
  const rows: any = { a: { propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, unit: { id: "u", propertyId: "p" } },
    b: { propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, unit: { id: "u", propertyId: "p" } } };
  let token = "";
  const authority = load("lib/session.ts", { crypto, "next/headers": { cookies: async () => ({ get: () => ({ value: token }), set() {} }) },
    "@/lib/prisma": { prisma: { tenantAssignment: { findUnique: async ({ where }: any) => rows[where.id] ?? null } } } });
  token = authority.createSessionToken({ ...session, tenantAssignmentId: "a" }); const old = token;
  assert.equal((await authority.getSession()).tenantAssignmentId, "a");
  const f = maintenanceFixture(); f.imports["@/lib/session"] = authority;
  assert.deepEqual(Array.from((await load("app/api/tenant/maintenance/list/route.ts", f.imports).GET()).body.requests, (r: any) => r.id), ["a"]);
  rows.a.isCurrent = false; rows.a.moveOutDate = new Date(0);
  assert.equal(await authority.getSession(), null); assert.equal(f.rows.some(row => row.id === "a"), true);
  token = authority.createSessionToken(session);
  assert.deepEqual(Array.from((await load("app/api/tenant/maintenance/list/route.ts", f.imports).GET()).body.requests, (r: any) => r.id), ["b"]);
  token = old; assert.equal(await authority.getSession(), null);
  for (const changes of [{ propertyId: "q" }, { unitId: "v" }]) {
    token = authority.createSessionToken({ ...session, ...changes }); assert.equal(await authority.getSession(), null);
  }
  const payload = Buffer.from(JSON.stringify({ role: "TENANT", propertyId: "p", unitId: "u", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+100 })).toString("base64url");
  token = payload + "." + crypto.createHmac("sha256", "isolated-history").update(payload).digest("base64url");
  assert.equal(await authority.getSession(), null);
});
for (const role of ["OWNER", "MANAGER", "STAFF", "MAINTENANCE"]) test("operational history retained for " + role, async () => {
  const f = maintenanceFixture({ ...session, role });
  const api = load("app/api/manager/maintenance/route.ts", f.imports);
  const result = await api.GET(); assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.body.requests, (r: any) => r.id), ["a", "b", "null", "wrong-unit"]);
  if (role === "MAINTENANCE") {
    const worker = await load("app/api/maintenance/dashboard/route.ts", f.imports).GET();
    assert.deepEqual(Array.from(worker.body.requests, (r: any) => r.id), ["a", "b", "null", "wrong-unit"]);
  }
});
