import { test } from "node:test";
import assert from "node:assert/strict";
import { source, response, request } from "./required-audit-atomicity.test";

function fixture(role: string | null = "ADMIN", target = true, failAudit = false) {
  const events: any[] = [];
  const api = source("app/api/admin/impersonate/route.ts", {
    "next/server": response,
    "next/headers": { cookies: async () => ({ get: () => ({ value: "admin-token" }), set: (...args: any[]) => events.push(["cookie", ...args]) }) },
    "@/lib/session": { SESSION_COOKIE_NAME: "rf_session", getSession: async () => role ? { role, adminAccessId: "admin" } : null,
      createManagementCredentialBinding: (id: string, hash: string) => { assert.equal(id, "user"); assert.equal(hash, "synthetic-credential"); return "b".repeat(64); },
      createSessionToken: (claims: any) => { assert.equal(claims.role, "STAFF"); assert.equal(claims.propertyId, "p"); assert.equal(claims.managementCredentialBinding, "b".repeat(64)); return "impersonated-token"; } },
    "@/lib/prisma": { prisma: {
      managementUser: { findFirst: async ({ where }: any) => { assert.equal(where.propertyId, "p"); assert.equal(where.isActive, true); return target ? { id: "user", propertyId: "p", role: "STAFF", passwordHash: "synthetic-credential" } : null; } },
      property: { findUnique: async () => ({ id: "p", name: "Property", propertyCode: "CODE" }) },
      auditLog: { create: async ({ data }: any) => { if (failAudit) throw Error("audit failure"); events.push(["audit", data]); } },
    } },
  });
  return { events, call: () => api.POST(request({ propertyId: "p", managementUserId: "user" })) };
}
test("impersonation audit failure queues neither cookie", async () => {
  const f = fixture("ADMIN", true, true); assert.equal((await f.call()).status, 500); assert.equal(f.events.length, 0);
});
test("impersonation persists audit before unchanged backup and active cookies", async () => {
  const f = fixture(); const result = await f.call(); assert.equal(result.status, 200); assert.equal(result.body.redirectTo, "/manager/dashboard");
  assert.deepEqual(f.events.map(row => row[0]), ["audit", "cookie", "cookie"]);
  assert.equal(f.events[0][1].action, "ADMIN_IMPERSONATION_STARTED");
  assert.equal(f.events[0][1].actorAdminId, "admin");
  assert.deepEqual(f.events.slice(1).map(row => row.slice(1, 3)), [["rf_admin_session", "admin-token"], ["rf_session", "impersonated-token"]]);
  for (const row of f.events.slice(1)) assert.deepEqual(JSON.parse(JSON.stringify(row[3])), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3600 });
});
for (const role of [null, "OWNER", "MANAGER", "STAFF"]) test("impersonation retains ADMIN boundary " + role, async () => {
  const f = fixture(role); assert.equal((await f.call()).status, 401); assert.equal(f.events.length, 0);
});
test("impersonation invalid target queues no cookies or audit", async () => {
  const f = fixture("ADMIN", false); assert.equal((await f.call()).status, 404); assert.equal(f.events.length, 0);
});
