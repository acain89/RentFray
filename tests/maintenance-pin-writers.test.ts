import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { loadSource, loginFixture, pinHelpers } from "./maintenance-pin-credential-compatibility.test";

const legacyFile = "app/manager/properties/[id]/pin-reset/page.tsx";
const dashboardFile = "app/api/manager/maintenance/pin/route.ts";
function writerFixture(existing = false, role = "OWNER", fail: "audit" | "business" | null = null) {
  let state: any = { worker: existing ? { id: "worker", propertyId: "p", displayName: "Worker", pinHash: "old" } : null, unit: null, audits: [] };
  let inTransaction = false;
  const events: string[] = [];
  const write = (fn: () => any) => { assert.equal(inTransaction, true); if (fail === "business") throw Error("Business failure"); return fn(); };
  const db: any = {
    maintenanceUser: {
      findFirst: async ({ where }: any) => {
        events.push("worker.lookup"); assert.equal(where.propertyId, "p");
        return state.worker && (!where.id || where.id === state.worker.id) && (!where.displayName || where.displayName === state.worker.displayName) ? state.worker : null;
      },
      create: async ({ data }: any) => write(() => { events.push("worker.create"); return state.worker = { id: "worker", ...data }; }),
      update: async ({ where, data }: any) => write(() => { assert.equal(where.id, "worker"); events.push("worker.update"); return Object.assign(state.worker, data); }),
    },
    unit: {
      findFirst: async ({ where }: any) => { assert.equal(where.propertyId, "p"); return { id: "unit", unitNumber: "101", tenantAssignments: [{ id: "assignment" }] }; },
      update: async ({ data }: any) => write(() => state.unit = { ...data }),
    },
    auditLog: { create: async ({ data }: any) => { assert.equal(inTransaction, true); if (fail === "audit") throw Error("Audit failure"); events.push("audit"); state.audits.push(data); } },
    $transaction: async (operation: any) => {
      const before = structuredClone(state); events.push("begin"); inTransaction = true;
      try { return await operation(db); } catch (error) { state = before; events.push("rollback"); throw error; }
      finally { inTransaction = false; events.push("end"); }
    },
  };
  const session = () => ({ role, propertyId: "p", managementUserId: "manager" });
  const imports = {
    "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: {} },
    "@/lib/session": { getSession: async () => session(), requireManagerLevelSession: async () => {
      if (!["OWNER", "MANAGER"].includes(role)) throw Error("Forbidden"); return session();
    } },
    "@/lib/permissions": { canManageMaintenancePins: (r: string) => ["OWNER", "MANAGER"].includes(r) },
    "bcryptjs": { hash: async (pin: string, rounds: number) => {
      assert.equal(inTransaction, false); assert.equal(rounds, 10); events.push("bcrypt.hash"); return bcrypt.hash(pin, rounds);
    } },
    "@/lib/pin": { isValidFourDigitPin: pinHelpers.isValidFourDigitPin, hashPin: (pin: string) => {
      assert.equal(inTransaction, false); events.push("tenant.scrypt"); return pinHelpers.hashPin(pin);
    } },
    "next/navigation": { redirect: (url: string) => { throw Error("redirect:" + url); } },
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } },
    "react/jsx-runtime": {},
  };
  const legacy = loadSource(legacyFile, imports, "\nexport { saveMaintenancePin, resetTenantPin };");
  const dashboard = loadSource(dashboardFile, imports);
  const form = (extra: any = {}) => {
    const fields: any = { propertyId: "p", pin: "1234", workerName: "New Worker", maintenanceUserId: existing ? "worker" : "", unitId: "unit", ...extra };
    return { get: (key: string) => fields[key] ?? null };
  };
  return { events, state: () => state, legacy: (extra: any = {}) => legacy.saveMaintenancePin(form(extra)),
    tenant: () => legacy.resetTenantPin(form()), dashboard: () => dashboard.POST({ json: async () => ({ pin: "1234" }) }) };
}

test("dashboard maintenance setter production source unchanged from HEAD", () => {
  const root = resolve(__dirname, "..");
  const committed = execFileSync("git", ["--no-optional-locks", "show", "HEAD:" + dashboardFile], { cwd: root, encoding: "utf8" });
  assert.equal(readFileSync(resolve(root, dashboardFile), "utf8").replace(/\r\n/g, "\n"), committed.replace(/\r\n/g, "\n"));
});
for (const existing of [false, true]) for (const surface of ["legacy", "dashboard"] as const) {
  for (const role of ["OWNER", "MANAGER"]) test(`${surface} ${role} ${existing ? "reset" : "create"} writes bcrypt 10 and authenticates`, async () => {
    const f = writerFixture(existing, role);
    if (surface === "legacy") await assert.rejects(f.legacy(), /redirect:.*maintenanceSuccess=1/);
    else assert.equal((await f.dashboard()).status, 200);
    const worker = f.state().worker;
    assert.equal(bcrypt.getRounds(worker.pinHash), 10); assert.equal(await bcrypt.compare("1234", worker.pinHash), true);
    assert.ok(f.events.indexOf("bcrypt.hash") < f.events.indexOf("begin"));
    assert.equal(f.events.includes("tenant.scrypt"), false);
    assert.equal(f.state().audits.length, 1);
    assert.equal(f.state().audits[0].action, surface === "dashboard" ? "MAINTENANCE_PIN_SET" : existing ? "MAINTENANCE_PIN_RESET" : "MAINTENANCE_USER_CREATED_WITH_PIN");
    const login = loginFixture([{ ...worker, isActive: true }]);
    assert.equal((await login.post()).body.maintenanceUserId, worker.id);
  });
  for (const fail of ["audit", "business"] as const) test(`${surface} ${existing ? "reset" : "create"} rolls back ${fail} failure`, async () => {
    const f = writerFixture(existing, "OWNER", fail); const before = structuredClone(f.state());
    if (surface === "legacy") await assert.rejects(f.legacy(), /failure/i); else assert.equal((await f.dashboard()).status, 500);
    assert.deepEqual(f.state(), before); assert.ok(f.events.includes("rollback"));
  });
}
test("tenant branch still writes existing scrypt credential and audit atomically", async () => {
  const f = writerFixture(); await assert.rejects(f.tenant(), /redirect:.*tenantSuccess=1/);
  assert.equal(pinHelpers.verifyPin("1234", f.state().unit.tenantPinHash), true);
  assert.match(f.state().unit.tenantPinHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(f.state().audits[0].action, "TENANT_PIN_RESET");
  assert.ok(f.events.indexOf("tenant.scrypt") < f.events.indexOf("begin")); assert.equal(f.events.includes("bcrypt.hash"), false);
});
for (const role of ["STAFF", "TENANT", "MAINTENANCE", "ADMIN"]) test(role + " cannot write maintenance PIN", async () => {
  const f = writerFixture(false, role); await assert.rejects(f.legacy(), /redirect:/); assert.deepEqual(f.events, []);
  assert.equal((await f.dashboard()).status, 401); assert.deepEqual(f.events, []);
});
for (const role of ["OWNER", "MANAGER"]) test(role + " cannot change foreign property/worker", async () => {
  const f = writerFixture(true, role); await assert.rejects(f.legacy({ propertyId: "other" }), /redirect:/);
  assert.equal(f.events.length, 0);
  await assert.rejects(f.legacy({ maintenanceUserId: "foreign" }), /Maintenance.*not.*found|redirect:.*maintenanceError/);
  assert.equal(f.events.includes("begin"), false); assert.equal(f.state().worker.pinHash, "old");
});
