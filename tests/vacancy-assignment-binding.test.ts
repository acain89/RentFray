import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
import ts from "typescript";
import { fixture as tenancyFixture, root, load } from "./tenant-login-assignment-race.test";

function fixture(role: string | null = "MANAGER") {
  const f = tenancyFixture(role);
  f.db.payment = { findMany: async () => [] };
  f.imports["@/lib/checkoutCollectibility"] = load("lib/checkoutCollectibility.ts", { stripe: class {} }, { process: { env: {} } });
  return f;
}
const file = "app/api/manager/units/vacate/route.ts";
const vacate = (f: ReturnType<typeof fixture>, extra: any = {}) => f.invoke(file, { unitId: "u", tenantAssignmentId: "a", ...extra });
for (const role of ["OWNER", "MANAGER"]) test(role + " exact vacancy preserves response, credentials, audit and realtime", async () => {
  const f = fixture(role); const result = await vacate(f);
  assert.equal(result.status, 200); assert.equal(result.body.data.vacatedAssignmentId, "a");
  assert.equal(f.state().assignments[0].isCurrent, false); assert.equal(f.state().unit.tenantPinHash, null);
  assert.equal(f.state().unit.portalActivated, false); assert.equal(f.state().audits[0].action, "UNIT_VACATED");
  assert.equal(f.realtime.length, 3); assert.ok(f.realtime.every(e => e[1].propertyId === "p"));
});
for (const change of ["replaced-before", "replaced-at-lock", "foreign-property", "foreign-unit", "vacated"]) test("vacancy rejects " + change + " without clearing replacement authority", async () => {
  const f = fixture();
  if (change === "replaced-before") f.replace();
  else if (change === "replaced-at-lock") f.controls.onLock = f.replace;
  else if (change === "foreign-property") f.state().assignments[0].propertyId = "other";
  else if (change === "foreign-unit") f.state().assignments[0].unitId = "other";
  else f.state().assignments[0].isCurrent = false;
  assert.equal((await vacate(f)).status, 409);
  assert.equal(f.state().unit.portalActivated, true); assert.equal(f.state().unit.tenantPinHash, change.startsWith("replaced") ? "hash-B" : "hash-A");
  assert.equal(f.state().audits.length, 0); assert.equal(f.realtime.length, 0);
  assert.ok(!f.events.some(e => ["assignment.write", "unit.write"].includes(e[0])));
});
test("future move-out eligibility remains accepted and supplied future vacancy remains immediate", async () => {
  const f = fixture(); f.state().assignments[0].moveOutDate = new Date("2100-01-01");
  assert.equal((await vacate(f, { moveOutDate: "2099-12-31", note: "departure" })).status, 200);
  assert.equal(f.state().assignments[0].isCurrent, false); assert.equal(f.state().unit.portalActivated, false);
  assert.equal(f.state().assignments[0].notes, "departure");
});
test("required vacancy audit failure rolls back assignment and credential clearing", async () => {
  const f = fixture(); f.controls.failAudit = true; assert.equal((await vacate(f)).status, 500);
  assert.equal(f.state().assignments[0].isCurrent, true); assert.equal(f.state().unit.tenantPinHash, "hash-A"); assert.equal(f.realtime.length, 0);
});
for (const role of [null, "STAFF", "TENANT", "MAINTENANCE", "ADMIN"]) test("vacancy role denial " + role, async () => {
  const f = fixture(role); assert.equal((await vacate(f)).status, role ? 403 : 401); assert.equal(f.events.length, 0);
});
for (const value of [undefined, null, ""]) test("vacancy requires expected assignment " + value, async () => {
  const f = fixture(); assert.equal((await vacate(f, { tenantAssignmentId: value })).status, 400); assert.equal(f.events.length, 0);
});
test("dashboard confirmation freezes A while selected Unit refreshes to B", async () => {
  const source = readFileSync(resolve(root, "app/manager/dashboard/ManagerDashboardClient.tsx"), "utf8");
  const tree = ts.createSourceFile("dashboard.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let submit: ts.FunctionDeclaration | undefined; let capture: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "submitVacateUnit") submit = node;
    if (ts.isArrowFunction(node) && node.getText(tree).includes("setVacateTarget({")) capture = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(submit); assert.ok(capture);
  const globals: any = { selectedUnit: { unitId: "u", tenantAssignmentId: "a" }, vacatingUnit: false, canVacateUnit: true,
    setVacateTarget: (value: any) => { globals.vacateTarget = value; }, setShowVacateConfirm() {}, setVacatingUnit() {}, setVacateError() {},
    setData() {}, closeUnitPanel() {}, setSelectedUnit() {},
    fetch: async (_: any, options: any) => { globals.sent = JSON.parse(options.body); return { ok: false, json: async () => ({ error: "stale" }) }; } };
  const code = ts.transpileModule(submit!.getText(tree) + "\nconst capture = " + capture!.getText(tree) + ";", { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = runInNewContext(code + "\n({ submitVacateUnit, capture })", globals);
  context.capture(); globals.selectedUnit = { unitId: "u", tenantAssignmentId: "b" };
  await context.submitVacateUnit(); assert.equal(globals.sent.tenantAssignmentId, "a"); assert.equal(globals.sent.unitId, "u");
});
