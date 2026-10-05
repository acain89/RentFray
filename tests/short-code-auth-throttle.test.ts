import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./manual-payment-idempotency.test";
import { throttleFixture } from "./auth-throttle-concurrency.test";

function loginFixture() {
  const f = throttleFixture();
  const events: string[] = [];
  const controls = { configured: true, correct: true, users: [{ id: "u", pinHash: "bcrypt-hash" }] };
  const imports: any = {
    "@/lib/authThrottle": f.api,
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body: JSON.parse(JSON.stringify(body)), status: options.status ?? 200, headers: options.headers ?? {} }) } },
    bcryptjs: { compare: async () => { assert.equal(f.controls.inTransaction, false); events.push("bcrypt"); return controls.correct; } },
    "@/lib/prisma": { prisma: {
      adminAccess: { findFirst: async (query: any) => { events.push("admin.lookup"); assert.equal(query.where.isActive, true); assert.equal(query.orderBy.createdAt, "desc"); return controls.configured ? { id: "admin", codeHash: "hash" } : null; }, update: async () => events.push("lastUsedAt") },
      maintenanceUser: { findMany: async (query: any) => { events.push("users.lookup"); assert.equal(query.where.isActive, true); return controls.users; }, update: async () => events.push("lastLoginAt") },
    } },
    "@/lib/session": { createSessionToken: (payload: any) => { events.push("session:" + JSON.stringify(payload)); return "isolated-token"; }, setSessionCookie: async () => events.push("cookie"), getSession: async () => ({ role: "ADMIN" }) },
  };
  const admin = load("app/api/admin/session/route.ts", imports);
  const maintenance = load("app/api/maintenance/session/route.ts", imports);
  const request = (body: any) => ({ json: async () => body });
  return { ...f, events, controls: { login: controls, throttle: f.controls }, admin, maintenance,
    postAdmin: (code: any = "123456") => admin.POST(request({ code })),
    postMaintenance: (propertyCode: any = "AAAA", pin: any = "1234") => maintenance.POST(request({ propertyCode, pin })),
  };
}

test("ADMIN successes and rotated valid codes consume one budget; correct denied before lookup/bcrypt/session", async () => {
  const f = loginFixture();
  for (let i = 0; i < 10; i++) { const r = await f.postAdmin(String(100000 + i)); assert.deepEqual(r.body, { ok: true, role: "ADMIN" }); assert.equal(r.status, 200); }
  const before = f.events.length; const r = await f.postAdmin(); assert.equal(r.status, 429); assert.ok(Number(r.headers["Retry-After"]) > 0); assert.equal(f.events.length, before);
  assert.equal(f.events.filter(e => e === "cookie").length, 10); assert.equal(f.events.filter(e => e === "lastUsedAt").length, 10);
  assert.ok(f.events.includes('session:{"role":"ADMIN"}')); assert.equal(f.rows.size, 1);
});
for (const code of ["", "12345", "1234567", "abcdef", null]) test("ADMIN malformed preserved " + code, async () => {
  const f = loginFixture(); const r = await f.postAdmin(code); assert.equal(r.status, 400); assert.equal(r.body.error, "Invalid admin code."); assert.equal(f.rows.size, 0); assert.equal(f.events.length, 0);
});
test("ADMIN absent/disabled access preserves 500 and admitted bad credential preserves 401", async () => {
  const f = loginFixture(); f.controls.login.configured = false;
  const r = await f.postAdmin(); assert.equal(r.status, 500); assert.equal(r.body.error, "Admin access is not configured."); assert.ok(!f.events.includes("bcrypt"));
  f.controls.login.configured = true; f.controls.login.correct = false; assert.equal((await f.postAdmin()).status, 401); assert.ok(!f.events.includes("cookie")); assert.equal(f.rows.get("admin:global")!.attemptCount, 2);
});
test("MAINTENANCE success payload/lastLoginAt preserved; PIN/user rotation cannot bypass property ceiling", async () => {
  const f = loginFixture();
  for (let i = 0; i < 10; i++) { f.controls.login.users = [{ id: "u" + i, pinHash: "hash" }]; const r = await f.postMaintenance("AAAA", String(1000 + i)); assert.equal(r.status, 200); assert.deepEqual(r.body, { ok: true, role: "MAINTENANCE", propertyId: "A", maintenanceUserId: "u" + i }); }
  const before = f.events.length; const r = await f.postMaintenance(); assert.equal(r.status, 429); assert.ok(Number(r.headers["Retry-After"]) > 0); assert.equal(f.events.length, before);
  assert.equal(f.events.filter(e => e === "lastLoginAt").length, 10);
  assert.ok(f.events.includes('session:{"role":"MAINTENANCE","propertyId":"A","maintenanceUserId":"u0"}'));
  assert.equal((await f.postMaintenance("BBBB")).status, 200); assert.equal(f.rows.get("maintenance:global")!.attemptCount, 12);
});
test("unknown codes preserve 404, consume global capacity and global exhaustion skips all credential work", async () => {
  const f = loginFixture();
  for (let i = 0; i < 100; i++) { const r = await f.postMaintenance("unknown" + i); assert.equal(r.status, 404); assert.equal(r.body.error, "Property not found."); }
  const r = await f.postMaintenance(); assert.equal(r.status, 429); assert.equal(f.events.length, 0); assert.equal(f.rows.size, 1);
});
for (const [property, pin, message] of [["abc", "1234", "Invalid property code."], ["AAAA", "123", "Invalid PIN."], ["AAAA", "abcd", "Invalid PIN."]]) test("MAINTENANCE invalid format preserved " + message + pin, async () => {
  const f = loginFixture(); const r = await f.postMaintenance(property, pin); assert.equal(r.status, 400); assert.equal(r.body.error, message); assert.equal(f.rows.size, 0);
});
test("inactive/status/user credential behavior preserved after admission", async () => {
  const f = loginFixture(); const property = f.properties.get("AAAA"); property.isActive = false;
  assert.equal((await f.postMaintenance()).status, 404); assert.equal(f.rows.get("maintenance:property:A")!.attemptCount, 1);
  property.isActive = true; property.status = "UNAVAILABLE"; assert.equal((await f.postMaintenance()).status, 403);
  property.status = "LIVE"; f.controls.login.correct = false; assert.equal((await f.postMaintenance()).status, 401); assert.ok(!f.events.includes("cookie"));
});
for (const kind of ["ADMIN", "MAINTENANCE"]) test(kind + " admission DB failure skips bcrypt and session", async () => {
  const f = loginFixture(); f.controls.throttle.error = Error("database unavailable");
  assert.equal((await (kind === "ADMIN" ? f.postAdmin() : f.postMaintenance())).status, 500); assert.equal(f.events.length, 0); assert.equal(f.rows.size, 0);
});
test("malformed JSON preserves server failure without admission", async () => {
  const f = loginFixture(); const request: any = { json: async () => { throw Error("malformed"); } };
  assert.equal((await f.admin.POST(request)).status, 500); assert.equal((await f.maintenance.POST(request)).status, 500); assert.equal(f.rows.size, 0);
});
