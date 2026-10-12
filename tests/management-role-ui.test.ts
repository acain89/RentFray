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
import { assertApprovedSessionConfigurationChange } from "./management-credential-revocation.test";
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
    const restoreAUD06Session = (source: string): string => {
      let restored = source.replace(/\r\n/g, "\n");
      const deltas: Array<[string, string, number]> = [
  [
    "",
    "export type SessionValidationOptions = Readonly<{ strictAuthority?: boolean }>;\n\n// Only errors created by session authorization may become 401/403 responses.\nexport class SessionAuthorizationError extends Error {\n  readonly status: 401 | 403;\n  constructor(status: 401 | 403) {\n    super(status === 401 ? \"Unauthorized\" : \"Forbidden\");\n    this.name = \"SessionAuthorizationError\";\n    this.status = status;\n  }\n}\n\n",
    1
  ],
  [
    "async function hasCurrentManagementAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentManagementAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "async function hasCurrentTenantAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentTenantAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "async function hasCurrentAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "export async function validateSessionToken(token: string): Promise<SessionPayload | null> {",
    "export async function validateSessionToken(token: string, options: SessionValidationOptions = {}): Promise<SessionPayload | null> {",
    1
  ],
  [
    "export async function getSession() {",
    "export async function getSession(options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function requireSession() {",
    "export async function requireSession(options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function requireRole(role: SessionRole) {",
    "export async function requireRole(role: SessionRole, options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function refreshSessionCookie(session: SessionPayload) {",
    "export async function refreshSessionCookie(session: SessionPayload, options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "} catch {\n    return false;",
    "} catch (error) {\n    if (options.strictAuthority) throw error;\n    return false;",
    2
  ],
  [
    "} catch {\n      return false;",
    "} catch (error) {\n      if (options.strictAuthority) throw error;\n      return false;",
    2
  ],
  [
    "hasCurrentManagementAuthority(session)",
    "hasCurrentManagementAuthority(session, options)",
    2
  ],
  [
    "hasCurrentTenantAuthority(session)",
    "hasCurrentTenantAuthority(session, options)",
    2
  ],
  [
    "hasCurrentAuthority(session)",
    "hasCurrentAuthority(session, options)",
    3
  ],
  [
    "validateSessionToken(token)",
    "validateSessionToken(token, options)",
    1
  ],
  [
    "getSession()",
    "getSession(options)",
    1
  ],
  [
    "requireSession()",
    "requireSession(options)",
    1
  ],
  [
    "throw new Error(\"Unauthorized\");",
    "throw new SessionAuthorizationError(401);",
    5
  ],
  [
    "throw new Error(\"Forbidden\");",
    "throw new SessionAuthorizationError(403);",
    1
  ]
];
      for (const [original, approved, count] of deltas) {
        assert.equal(restored.split(approved).length - 1, count, "Exact AUD-06 session delta: " + approved);
        restored = restored.split(approved).join(original);
      }
      return restored;
    };
  const sessionBefore = execFileSync("git", ["--no-optional-locks", "show", "HEAD:lib/session.ts"], { cwd: root, encoding: "utf8", windowsHide: true });
  const sessionAfter = restoreAUD06Session(readFileSync(resolve(root, "lib/session.ts"), "utf8"));
  assertApprovedSessionConfigurationChange(sessionBefore, sessionAfter);
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
    else if (file === "jobs/monthlyRent.ts") {
      // Only exact AUD-01 deltas are allowed; financial rules and identities
      // still pass the existing whole-source preservation assertion.
      const work = after.slice(after.indexOf("async function processMonthlyUnit"), after.indexOf("export async function runMonthlyRentJob"));
      const propertyLock = work.indexOf('FROM "Property"');
      assert.ok(propertyLock > work.indexOf("pg_advisory_xact_lock"));
      assert.ok(propertyLock >= 0 && propertyLock < work.indexOf("await tx.unit.findMany"), "Property lock must precede authoritative billing reads");
      const approvedChanges: Array<[string, string]> = [
        [
                "",
                "import { isManualRetryable } from \"@/lib/manualFinancialOperations\";\n"
        ],
        [
                "",
                "  // Only identity is read before the shared Property lock. Never reuse billing\n  // snapshots across the lock or across a transaction retry.\n  const identity = await tx.unit.findFirst({\n    where: { id: unitId, ...(propertyId ? { propertyId } : {}) },\n    select: { propertyId: true },\n  });\n  if (!identity) return chunkResult();\n  const lockedProperties = await tx.$queryRaw<Array<{ id: string }>>`\n    SELECT \"id\" FROM \"Property\" WHERE \"id\" = ${identity.propertyId} FOR UPDATE\n  `;\n  if (lockedProperties.length === 0) return chunkResult();\n  // Do not take assignment/cycle advisory locks after Property: existing\n  // financial writers take those locks first, then Property.\n"
        ],
        [
                "    where: { id: unitId, isActive: true, ...(propertyId ? { propertyId } : {}) },\n",
                "    where: { id: unitId, propertyId: identity.propertyId, isActive: true },\n"
        ],
        [
                "      const committed = await prisma.$transaction(\n        (tx: Prisma.TransactionClient) => processMonthlyUnit(tx, unit.id, asOf, propertyId),\n        { maxWait: 10000, timeout: 30000 }\n      );\n",
                "      let committed: MonthlyRentJobResult | undefined;\n      for (let attempt = 0; attempt < 3; attempt++) {\n        try {\n          committed = await prisma.$transaction(\n            (tx: Prisma.TransactionClient) => processMonthlyUnit(tx, unit.id, asOf, propertyId),\n            { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 30000 }\n          );\n          break;\n        } catch (error) {\n          if (attempt < 2 && isManualRetryable(error)) continue;\n          throw error;\n        }\n      }\n      if (!committed) throw new Error(\"Monthly billing transaction did not complete.\");\n"
        ]
];
      const committed = before.replace(/\r\n/g, "\n");
      for (const [original, approved] of approvedChanges) {
        assert.equal(after.split(approved).length, 2, "Exactly one approved AUD-01 change must remain present");
        if (!committed.includes(approved)) after = after.replace(approved, original);
      }
      assertApprovedMonthlyChange(committed, after);
    }
    else if (file === "app/api/manager/dashboard/route.ts") assert.equal(after, approvedAutomaticLifecycleChange(before.replace(/\r\n/g, "\n")), file);
    else if (file === "app/api/payments/create-session/route.ts") {
      const original = before.replace(/\r\n/g, "\n");
      const newCancel = 'cancel_url: `${origin}/tenant/dashboard`';
      assert.equal(original.split(newCancel).length, 2);
      const oldOrigin = 'process.env.NODE_ENV === "production" ? "https://rentfray.com"';
      const canonicalOrigin = 'process.env.NODE_ENV === "production" ? "https://www.rentfray.com"';
      assert.equal(original.split(oldOrigin).length, 2, "Exactly one committed production origin");
      assert.equal(after.split(canonicalOrigin).length, 2, "Exactly one approved canonical production origin");
      let restoredCheckout = after.replace(/\r\n/g, "\n");
      const authorizationDeltas: Array<[string, string]> = [
  [
    "import { getSession, refreshSessionCookie } from \"@/lib/session\";",
    "import { getSession, refreshSessionCookie, SessionAuthorizationError } from \"@/lib/session\";"
  ],
  [
    "await getSession()",
    "await getSession({ strictAuthority: true })"
  ],
  [
    "",
    "    if (session && session.role !== \"TENANT\") {\n      return NextResponse.json<ApiError>({ ok: false, error: \"Forbidden\" }, { status: 403 });\n    }\n\n"
  ],
  [
    "      !session ||\n      session.role !== \"TENANT\" ||",
    "      !session ||"
  ],
  [
    "await refreshSessionCookie(session);",
    "await refreshSessionCookie(session, { strictAuthority: true });"
  ],
  [
    "",
    "    if (error instanceof SessionAuthorizationError) {\n      return NextResponse.json<ApiError>({ ok: false, error: error.message }, { status: error.status });\n    }\n"
  ]
];
      for (const [previous, approved] of authorizationDeltas) {
        assert.equal(restoredCheckout.split(approved).length, 2, "Exactly one approved AUD-06 Checkout authorization delta");
        restoredCheckout = restoredCheckout.replace(approved, previous);
      }
      assert.equal(restoredCheckout, original.replace(oldOrigin, canonicalOrigin),
        "Only AUD-05 hostname and exact AUD-06 authorization deltas; complete Checkout authority remains preserved");
    }
    else assert.equal(after, before.replace(/\r\n/g, "\n"), file);
  }
});
