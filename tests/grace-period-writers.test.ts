/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma test doubles exercise actual routes without a database. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, load, request, context } from "./management-role-authorization.test";
import { parseGracePeriod, GRACE_PERIOD_MESSAGE, gracePeriodInputMax } from "../lib/gracePeriod";

const invalid: unknown[] = ["", " ", -1, "-1", 0.5, "2.5", 26, 55, "bad", true, false, [], [5], {}, null, NaN, Infinity, "Infinity", "1e1", "0x10", "25.0000000000000001", 2147483648];
const root = "app/api/admin/properties";

function writer(kind: "create" | "property" | "tiers" | "gplf" | "utility" | "action", saved = 5) {
  const f = fixture(kind === "create" ? "ADMIN" : "OWNER");
  const state = { settings: { id: "s", gracePeriodDays: saved }, tier: { id: "t", propertyId: "p", name: "Tier", unitCount: 2, gracePeriodDays: saved }, name: "Property" };
  const property = () => ({ id: "p", rentFrayStartDate: null, settings: { ...state.settings, rentDueDay: 1 } });
  f.db.property.findUnique = async () => kind === "create" ? null : property();
  f.db.property.update = async ({ data }: any) => { state.name = data.name; return property(); };
  f.db.propertySettings.findUnique = async () => kind === "create" ? null : { ...state.settings };
  f.db.propertySettings.update = async ({ data }: any) => { for (const k of Object.keys(data)) if (data[k] !== undefined) (state.settings as any)[k] = data[k]; return state.settings; };
  f.db.propertySettings.upsert = async ({ update }: any) => f.db.propertySettings.update({ data: update });
  f.db.propertyTier.findFirst = async () => ({ ...state.tier });
  f.db.propertyTier.findMany = async () => [{ ...state.tier, rentDueDay: 1 }];
  f.db.propertyTier.update = async ({ data }: any) => { for (const k of Object.keys(data)) if (data[k] !== undefined) (state.tier as any)[k] = data[k]; return state.tier; };
  f.imports["@/lib/billingCalendar"].getLockedMonthlyDueDay = () => null;
  let locked = false;
  f.db.$queryRaw = async () => { locked = true; return []; };
  f.db.$transaction = async (fn: any) => {
    const before = structuredClone(state);
    try { return await fn(f.db); }
    catch (error) { Object.assign(state, before); throw error; }
  };
  const utility = load("lib/propertySettings.ts", f.imports);
  f.imports["@/lib/propertySettings"] = utility;
  f.imports["@/app/components/GracePeriodInput"] = { __esModule: true, default: () => null };
  const file = kind === "action" ? "app/manager/properties/[id]/settings/page.tsx" : kind === "create" ? root + "/route.ts" : kind === "utility" ? "lib/propertySettings.ts" : root + "/[id]/" + (kind === "property" ? "" : kind + "/") + "route.ts";
  const api = load(file, f.imports, kind === "action" ? ";exports.saveSettings = saveSettings;" : "");
  async function save(value: unknown, omit = false, newTier = false) {
    const grace = omit ? {} : { graceDays: value };
    if (kind === "action") {
      try {
        await api.saveSettings({ has: (key: string) => key !== "gracePeriodDays" || !omit, get: (key: string) => key === "propertyId" ? "p" : key === "lateFeeValue" ? "0" : omit ? null : value });
        return { status: 200 };
      } catch (error) {
        if ((error as Error).message === "redirect:/manager/properties/p/settings") return { status: 200 };
        if ((error as Error).message.endsWith("settings?graceError=1")) return { status: 400, body: { error: GRACE_PERIOD_MESSAGE } };
        throw error;
      }
    }
    if (kind === "utility") return api.upsertPropertySettings("p", { ...(omit ? {} : { gracePeriodDays: value }), lateFeeEnabled: false });
    if (kind === "property") return api.PATCH(request({ name: "Edited", address: "Address", ...(omit ? {} : { gracePeriodDays: value }) }), context());
    if (kind === "create") return api.POST(request({ account: { fullName: "Owner", email: "owner@example.invalid", password: "password123" }, property: { name: "Property", address: "Address" }, tiers: [{ name: "Tier", unitLabels: "1", baseRent: 100, dueDay: 1, ...grace }] }), context());
    return api.POST(request({ tiers: [{ id: newTier ? "new-tier-1" : "t", tierName: "Tier", baseRent: "100", unitCount: "2", lateFeeEnabled: false, ...grace }] }), context());
  }
  return { ...f, state, api, save, locked: () => locked };
}

for (const kind of ["create", "property", "tiers", "gplf", "utility", "action"] as const) {
  for (const value of [0, "0", 25, "25"]) test(`${kind} accepts ${JSON.stringify(value)}`, async () => {
    const f = writer(kind); const result = await f.save(value);
    if (kind !== "utility") assert.equal(result.status, 200);
    if (kind === "property" || kind === "utility" || kind === "action") assert.equal(f.state.settings.gracePeriodDays, Number(value));
    if (kind === "tiers" || kind === "gplf") assert.equal(f.state.tier.gracePeriodDays, Number(value));
  });
  for (const [index, value] of invalid.entries()) test(`${kind} rejects invalid ${index} without committed changes`, async () => {
    const f = writer(kind); const before = structuredClone(f.state);
    if (kind === "utility") await assert.rejects(f.save(value), { message: GRACE_PERIOD_MESSAGE });
    else { const result = await f.save(value); assert.equal(result.status, 400); assert.equal(result.body.error, GRACE_PERIOD_MESSAGE); }
    assert.deepEqual(f.state, before);
    if (kind === "create") assert.equal(f.calls.some(([name]) => /\.(create|update|upsert)$/.test(name)), false);
  });
  if (kind !== "create") for (const legacy of [26, 31, 55]) {
    for (const omit of [false, true]) test(`${kind} preserves ${legacy}, omitted=${omit}`, async () => {
      const f = writer(kind, legacy); const result = await f.save(String(legacy), omit);
      if (kind !== "utility") assert.equal(result.status, 200);
      assert.equal(f.state.settings.gracePeriodDays, legacy);
      assert.equal(f.state.tier.gracePeriodDays, legacy);
      if (kind !== "property") assert.equal(f.locked(), true);
    });
    test(`${kind} replaces legacy ${legacy} with 25`, async () => {
      const f = writer(kind, legacy); const result = await f.save(25);
      if (kind !== "utility") assert.equal(result.status, 200);
      assert.equal(kind === "tiers" || kind === "gplf" ? f.state.tier.gracePeriodDays : f.state.settings.gracePeriodDays, 25);
    });
    test(`${kind} cannot copy legacy ${legacy} from another record`, async () => {
      const f = writer(kind, 5);
      if (kind === "utility") await assert.rejects(f.save(legacy), { message: GRACE_PERIOD_MESSAGE });
      else assert.equal((await f.save(legacy)).status, 400);
    });
  }
}
test("new tier cannot inherit a grandfathered grace", async () => {
  const f = writer("tiers", 55); assert.equal((await f.save(55, false, true)).status, 400);
});
test("grandfathering uses current saved state, never a submitted original", async () => {
  const f = writer("gplf", 55); f.state.tier.gracePeriodDays = 31;
  assert.equal((await f.save(55)).status, 400); assert.equal(f.state.tier.gracePeriodDays, 31);
});
test("ordinary numeric form strings are supported, invalid types never coerce", () => {
  assert.equal(parseGracePeriod(" 25 "), 25); assert.equal(parseGracePeriod("1.0"), 1);
  assert.equal(gracePeriodInputMax("55", 55), undefined);
  assert.equal(gracePeriodInputMax("56", 55), 25);
});

for (const kind of ["tiers", "gplf"] as const) test(`${kind} full payload rolls back all tiers when one grace is invalid`, async () => {
  const f = writer(kind, 55); const before = structuredClone(f.state);
  const response = await f.api.POST(request({ tiers: [
    { id: "t", tierName: "Tier", baseRent: "100", unitCount: "2", graceDays: "25", lateFeeEnabled: false },
    { id: "t", tierName: "Tier", baseRent: "100", unitCount: "2", graceDays: "2.5", lateFeeEnabled: false },
  ] }), context());
  assert.equal(response.status, 400); assert.equal(response.body.error, GRACE_PERIOD_MESSAGE);
  assert.deepEqual(f.state, before);
});

for (const kind of ["property", "utility"] as const) test(`${kind} cannot introduce legacy grace into new settings`, async () => {
  const f = writer(kind, 55); f.db.propertySettings.findUnique = async () => null;
  if (kind === "utility") await assert.rejects(f.save(55), { message: GRACE_PERIOD_MESSAGE });
  else assert.equal((await f.save(55)).status, 400);
});
