import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { load, root } from "./tenant-login-assignment-race.test";

const normalize = (value: string) => value.replace(/\r\n/g, "\n");
const read = (file: string) => normalize(readFileSync(resolve(root, file), "utf8"));
const baseline = (file: string) => normalize(execFileSync("git", ["show", "HEAD:" + file], { cwd: root, encoding: "utf8" }));
const jsx = (type: any, props: any) => ({ type, props });
for (const name of ["new", "remove"]) test("legacy tenant " + name + " renders retirement without database/mutation imports", async () => {
  const file = `app/manager/properties/[id]/tenants/${name}/page.tsx`;
  const source = read(file); assert.doesNotMatch(source, /use server|tenantAssignment|tenantPinHash|@\/lib\/prisma|AssignmentFields/);
  let authorized = 0;
  const imports = { "next/link": { default: "a", __esModule: true }, "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { notFound() { throw Error("not found"); } },
    "@/lib/session": { requireManagementSession: async () => { authorized++; return { propertyId: "p", role: "MANAGER" }; } } };
  const page = load(file, imports).default; const result = await page({ params: Promise.resolve({ id: "p" }) });
  assert.equal(authorized, 1); assert.ok(result); await assert.rejects(page({ params: Promise.resolve({ id: "other" }) }), /not found/);
});
test("combined PIN page removes tenant writer and form while preserving maintenance writer verbatim", () => {
  const file = "app/manager/properties/[id]/pin-reset/page.tsx"; const after = read(file), before = baseline(file);
  assert.doesNotMatch(after, /resetTenantPin|tenantPinHash|tenantAssignments|name="unitId"/);
  const writer = (s: string) => s.slice(s.indexOf("async function saveMaintenancePin"), s.indexOf("type PageSearchParams"));
  assert.equal(writer(after), writer(before)); assert.match(after, /form action=\{saveMaintenancePin\}/);
});
for (const operation of ["create", "reset"]) test("retained maintenance PIN " + operation + " still hashes, writes and audits atomically", async () => {
  const writes: any[] = [], audits: any[] = []; let inTx = false; let cost = 0;
  const db: any = { maintenanceUser: { findFirst: async ({ where }: any) => where.id ? { id: "w", displayName: "Worker" } : null },
    $transaction: async (fn: any) => { inTx = true; try { return await fn({ maintenanceUser: {
      create: async ({ data }: any) => { assert.equal(inTx, true); writes.push(data); return { id: "w", ...data }; },
      update: async ({ data }: any) => { assert.equal(inTx, true); writes.push(data); return { id: "w", ...data }; },
    }, auditLog: { create: async ({ data }: any) => { assert.equal(inTx, true); audits.push(data); } } }); } finally { inTx = false; } } };
  const module = load("app/manager/properties/[id]/pin-reset/page.tsx", {
    "next/navigation": { redirect: (url: string) => { throw Error("redirect:" + url); } }, "@prisma/client": { Prisma: {} },
    "bcryptjs": { hash: async (_: any, rounds: number) => { cost = rounds; return "bcrypt-hash"; } }, "@/lib/prisma": { prisma: db },
    "@/lib/session": { getSession: async () => ({ role: "MANAGER", propertyId: "p", managementUserId: "m" }) },
    "@/lib/pin": { isValidFourDigitPin: (value: string) => /^\d{4}$/.test(value) },
    "@/lib/permissions": { canManageMaintenancePins: (role: string) => ["OWNER", "MANAGER", "STAFF"].includes(role) },
    "react/jsx-runtime": { jsx, jsxs: jsx },
  }, {}, "\nexport { saveMaintenancePin };");
  const values: any = { propertyId: "p", maintenanceUserId: operation === "reset" ? "w" : "", workerName: "Worker", pin: "1234" };
  await assert.rejects(module.saveMaintenancePin({ get: (key: string) => values[key] ?? null }), /maintenanceSuccess=1/);
  assert.equal(cost, 10); assert.equal(writes[0].pinHash, "bcrypt-hash"); assert.equal(audits.length, 1);
  assert.equal(audits[0].action, operation === "reset" ? "MAINTENANCE_PIN_RESET" : "MAINTENANCE_USER_CREATED_WITH_PIN");
});
test("canonical activation, Unit PIN, session SSOT, payments, tier move and RF-04 remain unchanged", () => {
  for (const file of ["app/api/tenant/activate/route.ts", "app/manager/units/[id]/tenants/page.tsx", "lib/session.ts", "lib/pin.ts", "lib/pinLockout.ts",
    "app/api/manual-payments/route.ts", "app/api/manager/units/move-tier/route.ts", "app/api/payments/create-session/route.ts", "app/api/stripe/webhook/route.ts",
    "prisma/schema.prisma", "prisma/migrations/20261006010000_add_tier_charge_effective_until/migration.sql", "app/manager/properties/[id]/tenants/new/AssignmentFields.tsx"])
    assert.equal(read(file), baseline(file));
});
