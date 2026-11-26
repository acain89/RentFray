import assert from "node:assert/strict";
import { isRecord } from "./fixture-assertions";
import type { AdminAccess, MaintenanceUser, ManagementUser, TenantAssignment } from "@prisma/client";


import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";


export type Session = Omit<typeof import("../lib/session"), "createSessionToken" | "refreshSessionCookie"> & {
  createSessionToken(input: Record<string, unknown>): string;
  refreshSessionCookie(input: unknown): Promise<void>;
};
type ApiHandler = (request?: unknown) => Promise<{ status: number; body: Record<string, unknown> }>;
type ApiModules = {
 "app/api/admin/session/route.ts": { POST: ApiHandler };
 "app/api/maintenance/session/route.ts": { POST: ApiHandler };
 "app/api/auth/session/route.ts": { DELETE: ApiHandler };
 "app/api/maintenance/dashboard/route.ts": { GET: ApiHandler };
 "app/api/manager/maintenance/route.ts": { GET: ApiHandler };
 "app/api/manager/maintenance/update/route.ts": { POST: ApiHandler };
 "app/api/admin/impersonate/exit/route.ts": { GET(request: { url: string }): Promise<{ path: string; status?: number }>; POST(request: { url: string }): Promise<{ status: number; path?: string }> };
};
export function load(file: "lib/session.ts", imports: Record<string, unknown>): Session;
export function load<File extends keyof ApiModules>(file: File, imports: Record<string, unknown>): ApiModules[File];
export function load(file: string, imports: Record<string, unknown>): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Buffer, Date, URL,
    process: { env: { SESSION_SECRET: "synthetic-isolated-revalidation-session-secret-key", NODE_ENV: "production" } }, console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import " + name); return imports[name]; } });
  assert.ok(isRecord(fixtureModule.exports)); return fixtureModule.exports;
}
export function fixture(role = "ADMIN") {
  type CookieOptions = { maxAge?: number; httpOnly?: boolean; secure?: boolean; path?: string; sameSite?: string; expires?: Date };
  const values = new Map<string, string>(); const writes: { name: string; value: string; options: CookieOptions }[] = []; const reads: { id: string }[] = [];
  const state: {
    admin: (Pick<AdminAccess, "id" | "isActive"> & Partial<Pick<AdminAccess, "codeHash">>) | null;
    worker: Pick<MaintenanceUser, "id" | "propertyId" | "isActive" | "pinHash"> | null;
    management?: (Pick<ManagementUser, "id" | "propertyId" | "isActive" | "passwordHash"> & { role: string }) | null;
    assignment?: (Pick<TenantAssignment, "id" | "propertyId" | "unitId" | "isCurrent" | "moveOutDate"> & { unit: { id: string; propertyId: string } }) | null;
    fail: boolean;
  } = { admin: { id: "a", isActive: true, codeHash: "old" }, worker: { id: "w", propertyId: "p", isActive: true, pinHash: "old" }, fail: false };
  const headers = { cookies: async () => ({ get: (name: string) => values.has(name) ? { value: values.get(name) } : undefined,
    set: (name: string, value: string, options: CookieOptions) => { writes.push({ name, value, options }); values.set(name, value); } }) };
  const prisma = { adminAccess: { findUnique: async ({ where }: { where: { id: string } }) => { reads.push(where); if (state.fail) throw Error("DB down"); return state.admin?.id === where.id ? state.admin : null; } },
    maintenanceUser: { findUnique: async ({ where }: { where: { id: string } }) => { reads.push(where); if (state.fail) throw Error("DB down"); return state.worker?.id === where.id ? state.worker : null; } },
    managementUser: { findUnique: async ({ where }: { where: { id: string } }) => state.management?.id === where.id ? state.management : null },
    tenantAssignment: { findUnique: async ({ where }: { where: { id: string } }) => state.assignment?.id === where.id ? state.assignment : null } };
  const session = load("lib/session.ts", { crypto, "next/headers": headers, "@/lib/prisma": { prisma } });
  const payload = role === "ADMIN" ? { role, adminAccessId: "a" } : { role, maintenanceUserId: "w", propertyId: "p" };
  const token = session.createSessionToken(payload); values.set("rf_session", token);
  function signed(extra: Record<string, unknown>) { const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+1000, ...extra })).toString("base64url");
    return body + "." + crypto.createHmac("sha256", "synthetic-isolated-revalidation-session-secret-key").update(body).digest("base64url"); }
  return { session, state, values, writes, reads, headers, token, signed };
}
