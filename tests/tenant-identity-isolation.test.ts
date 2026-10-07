import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load<T>(file: string, imports: Record<string, unknown>): T {
  const target = { exports: {} };
  const source = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, { module: target, exports: target.exports, Buffer, Date,
    process: { env: { SESSION_SECRET: "isolated-tenant-identity-test-secret" } }, console: { error() {} },
    require(name: string) { assert.ok(name in imports, "unexpected import: " + name); return imports[name]; },
  });
  return target.exports as T;
}
function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
type Assignment = {
  id: string; propertyId: string; unitId: string; isCurrent: boolean; moveOutDate: Date | null;
  firstName: string | null; lastName: string | null;
};
function fixture() {
  const rows: Assignment[] = [{ id: "a", propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, firstName: "Alice", lastName: "Original" }];
  const unit = { id: "u", propertyId: "p", unitNumber: "1", portalFirstName: "Successor", portalLastName: "NeverReturn" };
  let token: string | undefined;
  let beforeIdentityRead = async () => {};
  const prisma = { tenantAssignment: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = rows.find(r => r.id === where.id);
      return row ? structuredClone({ ...row, unit }) : null;
    },
    findFirst: async ({ where, select }: { where: { id: string; propertyId: string; unitId: string; isCurrent: boolean; OR: [{ moveOutDate: null }, { moveOutDate: { gt: Date } }]; unit: { id: string; propertyId: string } }; select: Record<string, unknown> }) => {
      await beforeIdentityRead();
      assert.deepEqual(Object.keys(select).sort(), ["firstName", "lastName", "unit"]);
      const row = rows.find(r => r.id === where.id && r.propertyId === where.propertyId && r.unitId === where.unitId &&
        r.isCurrent === where.isCurrent && (r.moveOutDate === null || r.moveOutDate > where.OR[1].moveOutDate.gt) &&
        unit.id === where.unit.id && unit.propertyId === where.unit.propertyId);
      return row ? { firstName: row.firstName, lastName: row.lastName, unit: { id: unit.id, unitNumber: unit.unitNumber } } : null;
    },
  }, unit: { findUnique: async () => { throw new Error("Unit identity must never be read"); } } };
  const authority = load<{ createSessionToken(input: { role: "TENANT"; propertyId: string; unitId: string; tenantAssignmentId: string }): string }>("lib/session.ts", {
    crypto, "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) }, "@/lib/prisma": { prisma },
  });
  const route = load<{ GET(): Promise<Response> }>("app/api/tenant/me/route.ts", {
    "next/server": { NextResponse }, "@/lib/prisma": { prisma }, "@/lib/session": authority,
  });
  const login = (tenantAssignmentId = "a", propertyId = "p", unitId = "u") => {
    token = authority.createSessionToken({ role: "TENANT", tenantAssignmentId, propertyId, unitId });
  };
  const signed = (payload: Record<string, unknown>) => {
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    token = data + "." + crypto.createHmac("sha256", "isolated-tenant-identity-test-secret").update(data).digest("base64url");
  };
  const replace = () => {
    rows[0].isCurrent = false; rows[0].moveOutDate = new Date(0);
    rows.push({ ...rows[0], id: "b", firstName: "Beth", lastName: "Replacement", isCurrent: true, moveOutDate: null });
  };
  return { rows, unit, login, signed, replace, get: () => route.GET(), setToken: (value?: string) => { token = value; },
    pauseRead: (hook: () => Promise<void>) => { beforeIdentityRead = hook; } };
}
test("active tenant identity uses assignment names and preserves response shape", async () => {
  const f = fixture(); f.login(); const response = await f.get();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, unit: { id: "u", unitNumber: "1", portalFirstName: "Alice", portalLastName: "Original" } });
});
test("vacated A is rejected and replacement B receives only B identity", async () => {
  const f = fixture(); f.login(); f.replace(); assert.equal((await f.get()).status, 401);
  f.login("b"); const response = await f.get(); assert.equal(response.status, 200);
  assert.equal((await response.json()).unit.portalFirstName, "Beth");
});
for (const kind of ["missing", "malformed", "bad-signature", "expired", "assignmentless"]) test(`${kind} cookie is rejected by real session authority`, async () => {
  const f = fixture();
  if (kind === "malformed") f.setToken("malformed");
  if (kind === "bad-signature") f.setToken("e30.invalid");
  if (kind === "expired" || kind === "assignmentless") {
    const now = Math.floor(Date.now() / 1000);
    f.signed({ role: "TENANT", propertyId: "p", unitId: "u", iat: now - 100,
      exp: kind === "expired" ? now - 1 : now + 100, ...(kind === "expired" ? { tenantAssignmentId: "a" } : {}) });
  }
  assert.equal((await f.get()).status, 401);
});
for (const mismatch of ["property", "unit", "relation"]) test(`${mismatch} mismatch fails closed`, async () => {
  const f = fixture(); f.login();
  if (mismatch === "property") f.rows[0].propertyId = "other";
  if (mismatch === "unit") f.rows[0].unitId = "other";
  if (mismatch === "relation") f.unit.propertyId = "other";
  assert.equal((await f.get()).status, 401);
});
for (const change of ["replacement", "vacancy", "expired-departure", "scope"]) test(`${change} after session validation returns 401 without successor identity`, { timeout: 10000 }, async () => {
  const f = fixture(); f.login(); const arrived = barrier(), proceed = barrier();
  f.pauseRead(async () => { arrived.release(); await proceed.promise; });
  const request = f.get(); await arrived.promise;
  if (change === "replacement") f.replace();
  if (change === "vacancy") f.rows[0].isCurrent = false;
  if (change === "expired-departure") f.rows[0].moveOutDate = new Date(0);
  if (change === "scope") f.rows[0].propertyId = "other";
  proceed.release(); const response = await request;
  assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: "Unauthorized" });
});
test("nullable assignment names never fall back to successor Unit names", async () => {
  const f = fixture(); f.rows[0].firstName = null; f.rows[0].lastName = null; f.login();
  const response = await f.get(); assert.equal(response.status, 200);
  assert.equal((await response.json()).unit.portalFirstName, null);
});
