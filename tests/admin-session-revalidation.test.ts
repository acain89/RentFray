import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export function load(file: string, imports: Record<string, any>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, Buffer, Date, URL,
    process: { env: { SESSION_SECRET: "isolated-revalidation", NODE_ENV: "production" } }, console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import " + name); return imports[name]; } });
  return module.exports;
}
export function fixture(role = "ADMIN") {
  const values = new Map<string, string>(); const writes: any[] = []; const reads: any[] = [];
  const state: any = { admin: { id: "a", isActive: true, codeHash: "old" }, worker: { id: "w", propertyId: "p", isActive: true, pinHash: "old" }, fail: false };
  const headers = { cookies: async () => ({ get: (name: string) => values.has(name) ? { value: values.get(name) } : undefined,
    set: (name: string, value: string, options: any) => { writes.push({ name, value, options }); values.set(name, value); } }) };
  const prisma = { adminAccess: { findUnique: async ({ where }: any) => { reads.push(where); if (state.fail) throw Error("DB down"); return state.admin?.id === where.id ? state.admin : null; } },
    maintenanceUser: { findUnique: async ({ where }: any) => { reads.push(where); if (state.fail) throw Error("DB down"); return state.worker?.id === where.id ? state.worker : null; } },
    managementUser: { findUnique: async ({ where }: any) => state.management?.id === where.id ? state.management : null },
    tenantAssignment: { findUnique: async ({ where }: any) => state.assignment?.id === where.id ? state.assignment : null } };
  const session = load("lib/session.ts", { crypto, "next/headers": headers, "@/lib/prisma": { prisma } });
  const payload = role === "ADMIN" ? { role, adminAccessId: "a" } : { role, maintenanceUserId: "w", propertyId: "p" };
  const token = session.createSessionToken(payload); values.set("rf_session", token);
  function signed(extra: any) { const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+1000, ...extra })).toString("base64url");
    return body + "." + crypto.createHmac("sha256", "isolated-revalidation").update(body).digest("base64url"); }
  return { session, state, values, writes, reads, headers, token, signed };
}
for (const condition of ["active", "deleted", "inactive", "different", "db-error", "hash-only"]) test("ADMIN " + condition, async () => {
  const f = fixture(); if (condition === "deleted") f.state.admin = null;
  if (condition === "inactive") f.state.admin.isActive = false;
  if (condition === "different") f.state.admin = { id: "b", isActive: true };
  if (condition === "db-error") f.state.fail = true;
  if (condition === "hash-only") f.state.admin.codeHash = "replacement";
  assert.equal(Boolean(await f.session.getSession()), ["active", "hash-only"].includes(condition)); assert.deepEqual(JSON.parse(JSON.stringify(f.reads)), [{ id: "a" }]);
});
for (const id of [undefined, "", " ", 123, null]) test("ADMIN malformed/missing ID " + id, async () => {
  const f = fixture(); f.values.set("rf_session", f.signed({ adminAccessId: id })); assert.equal(await f.session.getSession(), null); assert.equal(f.reads.length, 0);
});
for (const active of [true, false]) test("ADMIN refresh active=" + active, async () => {
  const f = fixture(); const payload = f.session.verifySessionToken(f.token); f.state.admin.isActive = active;
  if (active) { await f.session.refreshSessionCookie(payload); assert.equal(f.session.verifySessionToken(f.writes[0].value).adminAccessId, "a"); }
  else { await assert.rejects(f.session.refreshSessionCookie(payload), /Unauthorized/); assert.equal(f.writes.length, 0); }
});
test("ADMIN login binds exact authenticating ID without changing response", async () => {
  const inputs: any[] = []; const route = load("app/api/admin/session/route.ts", {
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } },
    "bcryptjs": { compare: async () => true }, "@/lib/authThrottle": { admitAdminLogin: async () => ({ admitted: true }) },
    "@/lib/prisma": { prisma: { adminAccess: { findFirst: async () => ({ id: "selected", codeHash: "hash" }), update: async () => {} } } },
    "@/lib/session": { createSessionToken: (input: any) => { inputs.push(input); return "mock"; }, setSessionCookie: async () => {}, getSession: async () => null } });
  assert.deepEqual(JSON.parse(JSON.stringify(await route.POST({ json: async () => ({ code: "123456" }) }))), { body: { ok: true, role: "ADMIN" }, status: 200 });
  assert.deepEqual(JSON.parse(JSON.stringify(inputs)), [{ role: "ADMIN", adminAccessId: "selected" }]);
});
