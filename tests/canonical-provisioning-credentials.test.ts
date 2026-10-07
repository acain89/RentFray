import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fixture, load, request } from "./management-role-authorization.test";
import { assertApprovedProvisioningChange } from "./recurring-charge-boundaries-schema.test";
import { assertApprovedDraftChange } from "./admin-draft-credential-safety.test";

const root = resolve(__dirname, "..");
for (const kind of ["public", "admin"] as const) for (const mailFailure of [false, true]) {
  test(kind + " provisioning retains bcrypt, one OWNER and verification; mailFailure=" + mailFailure, async () => {
    const f = fixture(kind === "admin" ? "ADMIN" : null); let committed = false, emails = 0;
    f.db.property.findUnique = async () => null;
    f.db.$transaction = async (fn: any) => { const result = await fn(f.db); committed = true; return result; };
    const password = "isolated-password-123";
    f.imports["bcryptjs"] = { hash: async (value: string, cost: number) => {
      assert.equal(value, password); assert.equal(cost, kind === "public" ? 12 : 10); return bcrypt.hash(value, cost);
    } };
    f.imports["@/lib/email"].sendVerificationEmail = async (input: any) => {
      assert.equal(committed, true); assert.equal(input.email, "owner@example.invalid"); assert.ok(input.managementUserId); emails++;
      if (mailFailure) throw Error("isolated mail unavailable");
    };
    const file = kind === "public" ? "app/api/setup/create-account/route.ts" : "app/api/admin/properties/route.ts";
    const payload = kind === "public" ? { firstName: "Test", lastName: "Owner", email: "owner@example.invalid", password }
      : { account: { email: "owner@example.invalid", password, fullName: "Test Owner" }, property: { name: "Property", address: "Address" },
        tiers: [{ name: "Tier", unitLabels: "1", baseRent: 0, dueDay: 1, graceDays: 0, lateFeeInitial: 0, lateFeeDaily: 0, lateFeeMaxDays: 0 }] };
    const result = await load(file, f.imports).POST(request(payload)); assert.equal(result.status, 200);
    const owners = f.calls.filter(row => row[0] === "managementUser.create"); assert.equal(owners.length, 1);
    const data = owners[0][1].data; assert.equal(data.role, "OWNER"); assert.ok(data.passwordHash.startsWith("$2"));
    assert.equal(await bcrypt.compare(password, data.passwordHash), true); assert.ok(!data.passwordHash.includes("plain:"));
    assert.equal(data.isActive, kind === "admin"); assert.equal(emails, 1);
    assert.equal(result.body.verificationEmailSent, !mailFailure); assert.equal(f.calls.some(row => row[0] === "session"), false);
    const serialized = JSON.stringify(result.body); assert.ok(!serialized.includes(password)); assert.ok(!serialized.includes(data.passwordHash));
    assert.ok(!serialized.includes("tokenHash")); assert.ok(!serialized.includes("passwordHash"));
  });
}
test("canonical provisioning, verification, compatibility and hard-start authorities remain unchanged", () => {
  for (const file of ["app/api/setup/create-account/route.ts", "app/setup/page.tsx", "app/api/admin/properties/route.ts", "app/admin/properties/new/page.tsx",
    "app/api/auth/verify-email/route.ts", "lib/email.ts", "lib/managementAuth.ts", "lib/session.ts", "proxy.ts", "lib/billingCalendar.ts",
    "app/api/admin/properties/[id]/route.ts", "app/api/admin/properties/[id]/lifecycle/route.ts", "app/api/admin/properties/[id]/override/route.ts"]) {
    const baseline = file === "app/api/admin/properties/[id]/override/route.ts"
      ? "072eb51fdabd8f53d31b8a382e7b8fa513cab234"
      : "eda6c70dafc95079b2757d7ed5139ee03a225e5c";
    const before = execFileSync("git", ["--no-optional-locks", "show", baseline + ":" + file], { cwd: root, encoding: "utf8", windowsHide: true });
    const after = readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
    if (file === "app/api/admin/properties/route.ts") assertApprovedProvisioningChange(before.replace(/\r\n/g, "\n"), after);
    else if (file === "app/admin/properties/new/page.tsx") assertApprovedDraftChange(before.replace(/\r\n/g, "\n"), after);
    else assert.equal(after, before.replace(/\r\n/g, "\n"), file);
  }
});
