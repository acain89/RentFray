import { dateFromArguments } from "./fixture-assertions";


import { fixture, load } from "./manual-payment-idempotency.fixture";


export function calendarFixture(dueDay = 15, now = "2026-10-14T17:00:00Z", role: Parameters<typeof fixture>[0] = "MANAGER") {
  const f = fixture(role);
  f.property.rentFrayStartDate = new Date(`2026-01-${String(dueDay).padStart(2,"0")}T00:00:00Z`);
  Object.assign(f.property.settings, { rentDueDay: dueDay, gracePeriodDays: 2, lateFeeEnabled: false });
  Object.assign(f.tiers[0], { rentDueDay: dueDay, gracePeriodDays: 2, lateFeeInitialCents: 0, lateFeeDailyCents: 0, maxLateFeeDays: 0 });
  const RealDate = Date;
  class Clock extends RealDate { constructor(...args: unknown[]) { const date = dateFromArguments(args.length ? args : [now], RealDate); super(date.getTime()); if (args.length > 1) return date; } static now() { return new RealDate(now).getTime(); } }
  const dates = load("lib/rentDates.ts", {}, "", { Date: Clock });
  f.imports["@/lib/rentDates"] = dates;
  f.imports["@/lib/billingCalendar"] = load("lib/billingCalendar.ts", { "@prisma/client": {}, "@/lib/prisma": { prisma: f.prisma }, "@/lib/rentDates": dates });
  f.prisma.payment.findFirst = async () => { throw Error("Payment status must not be consulted"); };
  const invoke = (file: string, body: unknown) => load(file, f.imports, "", { Date: Clock }).POST({ json: async () => body });
  const adjust = (type = "CHARGE", extra: Record<string, unknown> = {}) => invoke("app/api/ledger/adjust/route.ts", { unitId:"u", tenantAssignmentId:"a", type, amount:100, memo:"test", ...extra });
  const charge = (effectiveDate = "2026-10-14", extra: Record<string, unknown> = {}) => invoke("app/api/ledger/charges/route.ts", { propertyId:"p", unitId:"u", tenantAssignmentId:"a", type:"OTHER_FEE", amount:100, memo:"test", effectiveDate, ...extra });
  return { ...f, dates, adjust, charge };
}
