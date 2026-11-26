import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { stage2Load } from "./representative-stage2-fixture";
import * as money from "../lib/configuredMoney";

const navigation = { redirect: (url: string): never => { throw Error("redirect:" + url); }, notFound: (): never => { throw Error("not-found"); } };
const Link = (props: React.ComponentProps<"a">) => React.createElement("a", props);
for (const cents of [12345, 0, null]) {
  test(`administrator actual page renders configured cents or unavailability: ${cents}`, async () => {
    const property = { id: "p", name: "Property", propertyCode: "1234", isActive: true, settings: { lateFeeFlatCents: cents, convenienceFeeAmountCents: cents },
      tiers: [{ id: "t", propertyId: "p", name: "Tier", baseRentCents: cents, processingFeeCents: cents, lateFeeInitialCents: cents, lateFeeDailyCents: cents,
        units: [{ id: "u", propertyId: "p", tierId: "t", unitNumber: "1", tenantAssignments: [], recurringFeeItems: [{ id: "f", propertyId: "p", unitId: "u", isActive: true, label: "Utility", amountCents: cents }] }] }] };
    const page = stage2Load<typeof import("../app/admin/properties/[id]/page")>("app/admin/properties/[id]/page.tsx", {
      "react/jsx-runtime": jsx, "next/link": Link, "next/navigation": navigation, "@/components/admin/AdminSupportTools": () => null,
      "@/lib/configuredMoney": money, "@/lib/session": { getSession: async () => ({ role: "ADMIN" }) },
      "@/lib/prisma": { prisma: { property: { findUnique: async (query: { where: { id: string } }) => { assert.equal(JSON.stringify(query.where), JSON.stringify({ id: "p" })); return property; } } } },
    });
    const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ id: "p" }) }));
    assert.equal(html.split(money.formatConfiguredMoney(cents)).length - 1, 9);
    if (cents === null) assert.ok(!html.includes("$0.00"));
  });
}
test("manager page uses current same-property tiers and never legacy unit overrides", async () => {
  const units = [{ id: "u", propertyId: "p", tierId: "t", unitNumber: "1", baseRentCents: 5, tenantAssignments: [], tier: { id: "t", propertyId: "p", baseRentCents: 12345 } },
    { id: "none", propertyId: "p", tierId: null, unitNumber: "2", baseRentCents: 99999, tenantAssignments: [], tier: null }];
  const page = stage2Load<typeof import("../app/manager/units/page")>("app/manager/units/page.tsx", {
    "react/jsx-runtime": jsx, "next/link": Link, "@/lib/configuredMoney": money,
    "@/lib/session": { requireManagementSession: async () => ({ propertyId: "p" }) },
    "@/lib/prisma": { prisma: { unit: { findMany: async (query: { where: { propertyId: string }; include: { tier: unknown } }) => {
      assert.equal(JSON.stringify(query.where), JSON.stringify({ propertyId: "p" })); assert.ok(query.include.tier); return units;
    } } } },
  });
  const html = renderToStaticMarkup(await page.default());
  assert.ok(html.includes("$123.45")); assert.ok(html.includes("Unavailable")); assert.ok(!html.includes("$999.99") && !html.includes("$0.05"));
});
