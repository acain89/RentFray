import { assertRF19Change } from "./stripe-account-reconciliation.test";

function approvedAutomaticLifecycleChange(before: string): string {
  const oldBlock = "      await prisma.property.update({\n        where: { id: property.id },\n        data: { status: \"READY\" },\n      });\n\n      property.status = \"READY\";";
  const newBlock = "      const transition = await prisma.property.updateMany({\n        where: { id: property.id, status: \"SETUP\" },\n        data: { status: \"READY\" },\n      });\n\n      if (transition.count === 1) {\n        property.status = \"READY\";\n      } else {\n        const currentProperty = await prisma.property.findUnique({\n          where: { id: property.id },\n          select: { status: true },\n        });\n        if (!currentProperty) throw new Error(\"Property not found.\");\n        property.status = currentProperty.status;\n      }";
  assert.equal(before.includes(oldBlock), false, "Unconditional automatic READY write remains retired");
  assert.equal(before.split(newBlock).length, 2, "Exactly one committed compare-and-set with authoritative zero-row reread");
  return before;
}
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fixture, load } from "./management-role-authorization.test";
import { assertApprovedMonthlyChange, assertApprovedSchemaChange } from "./recurring-charge-boundaries-schema.test";
import "./management-credential-revocation.test";
const root = resolve(__dirname, "..");
test("OWNER banking boundary remains explicit in untouched controls", () => {
  const bank = readFileSync(resolve(root, "app/manager/dashboard/components/BankPanel.tsx"), "utf8");
  assert.ok(bank.includes("{isOwner ? ("));
  for (const file of ["app/api/stripe/connect/route.ts", "app/api/stripe/onboard/route.ts"])
    assert.match(readFileSync(resolve(root, file), "utf8"), /session\.role !== "OWNER"/);
});
test("subordinate UI offers only MANAGER and STAFF", () => {
  const source = readFileSync(resolve(root, "app/manager/dashboard/components/ManagerPanel.tsx"), "utf8");
  assert.ok(source.includes('value="MANAGER"')); assert.ok(source.includes('value="STAFF"')); assert.ok(!source.includes('value="OWNER"'));
});
function render(node: any): any[] {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(render);
  if (typeof node !== "object") return [node];
  if (typeof node.type === "function") return render(node.type(node.props));
  return [node, ...render(node.props?.children)];
}
for (const role of ["OWNER", "MANAGER", "STAFF"]) test(role + " management controls agree with authority", () => {
  const f = fixture(role); const panel = load("app/manager/dashboard/components/ManagerPanel.tsx", f.imports).default;
  const tree = render(panel({ sessionRole: role, canManageManagers: role !== "STAFF", managers: [{ id: "owner", role: "OWNER", username: "owner" }, { id: "staff", role: "STAFF", username: "staff" }], inactiveUnits: [{ id: "unit", unitNumber: "1", tierName: "Tier", lastActiveAt: "2026-10-01" }], showInactiveUnits: true }));
  const text = tree.filter(n => typeof n === "string").join(" ");
  assert.ok(text.includes("Inactive units")); assert.equal(text.includes("Add manager or staff"), role !== "STAFF");
  assert.equal(text.includes("Your login"), role !== "STAFF"); assert.equal(text.includes("Reactivate"), role !== "STAFF");
  assert.equal(tree.filter(n => n.type === "select").every(n => n.props.disabled === true), role === "STAFF");
});
test("STAFF property and charge forms have disabled fieldsets", () => {
  for (const file of ["app/manager/dashboard/components/PropertyPanel.tsx", "app/manager/getting-started/property/page.tsx"])
    assert.ok(readFileSync(resolve(root, file), "utf8").includes('<fieldset disabled={!canEdit}'));
  for (const name of ["new", "remove"]) {
    const source = readFileSync(resolve(root, `app/manager/properties/[id]/tenants/${name}/page.tsx`), "utf8");
    assert.doesNotMatch(source, /<form|use server|createTenantAssignment|removeTenantAssignment/);
    assert.match(source, /requireManagementSession/);
    assert.match(source, /session\.propertyId !== id/);
  }
  const pin = readFileSync(resolve(root, "app/manager/properties/[id]/pin-reset/page.tsx"), "utf8");
  assert.doesNotMatch(pin, /resetTenantPin|tenantPinHash/);
  assert.match(pin, /form action=\{saveMaintenancePin\}/);
  assert.match(pin, /canManageMaintenancePins\(session\.role\)/);
  assert.ok(readFileSync(resolve(root, "app/manager/dashboard/ManagerDashboardClient.tsx"), "utf8").includes('<fieldset disabled={!canManageMoney}'));
  for (const file of ["app/manager/properties/[id]/maintenance/page.tsx", "app/manager/properties/page.tsx"])
    assert.ok(readFileSync(resolve(root, file), "utf8").includes("disabled={!canEdit || savingId === row.id}"));
});
test("financial, session, banking and automatic system authorities are unchanged", () => {
  const sessionBefore = execFileSync("git", ["--no-optional-locks", "show", "HEAD:lib/session.ts"], { cwd: root, encoding: "utf8", windowsHide: true });
  const sessionAfter = readFileSync(resolve(root, "lib/session.ts"), "utf8");
  assert.equal(sessionAfter.replace(/\r\n/g, "\n"), sessionBefore.replace(/\r\n/g, "\n"), "RF-18 must preserve the complete committed RF-15 session authority");
  for (const name of ["hasCurrentTenantAuthority"]) {
    const pattern = new RegExp("async function " + name + "[\\s\\S]*?\\n}");
    assert.equal(sessionAfter.replace(/\r\n/g, "\n").match(pattern)?.[0], sessionBefore.replace(/\r\n/g, "\n").match(pattern)?.[0]);
    assert.ok(sessionAfter.match(pattern));
  }
  for (const file of [ "lib/ledger.ts", "lib/unitFinancialState.ts", "lib/billingCalendar.ts", "lib/rentDates.ts", "lib/manualFinancialOperations.ts", "lib/email.ts", "app/api/manager/dashboard/route.ts", "app/api/stripe/connect/route.ts", "app/api/stripe/onboard/route.ts", "app/api/stripe/webhook/route.ts", "app/api/payments/create-session/route.ts", "app/manager/dashboard/components/BankPanel.tsx", "jobs/monthlyRent.ts", "jobs/lateFees.ts", "prisma/schema.prisma"]) {
    const baseline = file === "app/api/manager/dashboard/route.ts" ? "072eb51fdabd8f53d31b8a382e7b8fa513cab234" : "HEAD";
    if (["app/api/manager/dashboard/route.ts", "app/api/stripe/connect/route.ts", "app/api/stripe/webhook/route.ts"].includes(file)) {
      const committed = execFileSync("git", ["show", "88c74f36ee7041399eb5ad94f086f4b9cb010db8:" + file], { cwd: root, encoding: "utf8" });
      assertRF19Change(file, committed, readFileSync(resolve(root, file), "utf8"));
      continue;
    }
    const before = execFileSync("git", ["--no-optional-locks", "show", baseline + ":" + file], { cwd: root, encoding: "utf8", windowsHide: true });
    let after = readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
    if (file === "prisma/schema.prisma") assertApprovedSchemaChange(before.replace(/\r\n/g, "\n"), after);
    else if (file === "jobs/monthlyRent.ts") assertApprovedMonthlyChange(before.replace(/\r\n/g, "\n"), after);
    else if (file === "app/api/manager/dashboard/route.ts") assert.equal(after, approvedAutomaticLifecycleChange(before.replace(/\r\n/g, "\n")), file);
    else if (file === "app/api/payments/create-session/route.ts") {
      const original = before.replace(/\r\n/g, "\n");
      const newCancel = 'cancel_url: `${origin}/tenant/dashboard`';
      assert.equal(original.split(newCancel).length, 2);
      assert.equal(after.replace(/\r\n/g, "\n"), original,
        "RF-14 preserves the complete committed RF-13 Checkout authority");
    }
    else assert.equal(after, before.replace(/\r\n/g, "\n"), file);
  }
});
