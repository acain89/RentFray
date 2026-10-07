import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, load, request } from "./management-role-authorization.test";
import { monthlyFixture } from "./monthly-recurring-configuration.test";

test("ADMIN provisioning keeps recurring configuration and credentials but creates no ledger debt", async () => {
  const f = fixture("ADMIN"); let committed = false;
  for (const name of ["unitRecurringFee", "ledgerEntry"]) f.db[name] = {
    createMany: async (args: any) => { f.calls.push([name + ".createMany", args]); return { count: args.data.length }; },
    create: async (args: any) => { f.calls.push([name + ".create", args]); return args.data; },
  };
  f.db.property.findUnique = async () => null;
  f.db.$transaction = async (fn: any) => { const result = await fn(f.db); committed = true; return result; };
  f.imports["bcryptjs"].hash = async (password: string, cost: number) => { assert.equal(password, "password123"); assert.equal(cost, 10); return "$2b$isolated"; };
  f.imports["@/lib/email"].sendVerificationEmail = async () => { assert.equal(committed, true); f.calls.push(["verification", {}]); };
  const result = await load("app/api/admin/properties/route.ts", f.imports).POST(request({
    account: { fullName: "Owner", email: "owner@example.invalid", password: "password123" }, property: { name: "Property", address: "Address" },
    tiers: [{ name: "Tier", unitLabels: "1", baseRent: 100, dueDay: 1, graceDays: 0, lateFeeInitial: 0, lateFeeDaily: 0, lateFeeMaxDays: 0,
      charges: [{ label: "Water", amount: 25 }, { label: "Trash", amount: 10 }] }],
  }));
  assert.equal(result.status, 200); assert.ok(result.body.property); assert.equal(result.body.verificationEmailSent, true);
  assert.equal(f.calls.filter(c => c[0] === "managementUser.create" && c[1].data.role === "OWNER").length, 1);
  for (const model of ["property", "propertySettings", "propertyTier", "unit"]) assert.ok(f.calls.some(c => c[0] === model + ".create"));
  const fees = f.calls.find(c => c[0] === "unitRecurringFee.createMany")[1].data;
  assert.deepEqual(fees.map((r: any) => [r.label, r.amountCents, r.isActive]), [["Water", 2500, true], ["Trash", 1000, true]]);
  assert.equal(f.calls.some(c => c[0].startsWith("ledgerEntry.")), false);
  const monthly = monthlyFixture(); monthly.unit.recurringFeeItems = fees.map((r: any, i: number) => ({ ...r, id: "fee-" + i, createdAt: new Date("2026-09-01T12:00:00Z") }));
  await monthly.run(new Date("2026-10-20T12:00:00Z")); assert.equal(monthly.ledger.reduce((sum, r) => sum + r.amountCents, 0), 3500);
});
