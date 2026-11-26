
import assert from "node:assert/strict";
import type { LedgerEntry, Payment, TenantAssignment, Unit, AuditLog, PropertyTier } from "@prisma/client";
import { isRecord } from "./fixture-assertions";
import { load } from "./manual-payment-idempotency.fixture";




export function match(row: unknown, where: unknown = {}): boolean {
  assert.ok(isRecord(where), "Expected a structured late-fee query");
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR" || key === "AND") {
      assert.ok(Array.isArray(value));
      return key === "OR" ? value.some((part: unknown) => match(row, part)) : value.every((part: unknown) => match(row, part));
    }
    assert.ok(isRecord(row), "Expected a stored late-fee row");
    const field = row[key];
    if (isRecord(value) && !(value instanceof Date)) {
      if ("in" in value) { assert.ok(Array.isArray(value.in)); const values: unknown[] = value.in; return values.includes(field); }
      if ("startsWith" in value) { assert.ok(typeof value.startsWith === "string"); return typeof field === "string" && field.startsWith(value.startsWith); }
      if ("lte" in value) return typeof field === "string" && typeof value.lte === "string" ? field <= value.lte : Number(field) <= Number(value.lte);
      return match(field ?? {}, value);
    }
    return field === value;
  });
}
type LedgerRow = Partial<LedgerEntry> & Pick<LedgerEntry, "id" | "propertyId" | "unitId" | "entryType" | "amountCents" | "effectiveDate">;
type FeeInsert = Partial<LedgerEntry> & Pick<LedgerEntry, "propertyId" | "unitId" | "entryType" | "amountCents" | "effectiveDate">;
type ReadArgs = { where: { OR?: Record<string, unknown>[]; [key: string]: unknown } };
export function lateFixture() {
  const events: string[] = [];
  const controls: { onLock: ((sql: string, values: unknown[]) => void | Promise<void>) | null; snapshotBarrier: (() => void | Promise<void>) | null; fault: ((index: number, rows: FeeInsert[]) => void | Promise<void>) | null; financialHook: ((inTransaction: boolean) => void) | null } = { onLock: null, snapshotBarrier: null, fault: null, financialHook: null };
  const property = { id: "p", settings: { rentDueDay: 1, gracePeriodDays: 2, lateFeeEnabled: true },
    rentFrayStartDate: new Date("2026-01-01T00:00:00Z") };
  const tiers: (Partial<PropertyTier> & Pick<PropertyTier, "id" | "propertyId">)[] = [{ id: "tier", propertyId: "p", rentDueDay: 1, gracePeriodDays: 2,
    lateFeeInitialCents: 500, lateFeeDailyCents: 100, maxLateFeeDays: 3 }];
  const state: { units: (Partial<Unit> & { id: string })[]; assignments: Partial<TenantAssignment>[]; ledger: LedgerRow[]; payments: Partial<Payment>[]; audits: Partial<AuditLog>[] } = { units: [{ id: "u", propertyId: "p", unitNumber: "1", tierId: "tier", isActive: true }],
    assignments: [{ id: "a", propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, moveInDate: null }],
    ledger: [], payments: [], audits: [] };
  let inTransaction = false, tail = Promise.resolve(), attempts = 0, sequence = 0;
  const expand = (unit: Partial<Unit> & { id: string }) => ({ ...unit, tier: structuredClone(tiers.find(t => t.id === unit.tierId) ?? null),
    property: structuredClone(property), tenantAssignments: state.assignments.filter((a) =>
      a.unitId === unit.id && a.isCurrent && a.moveOutDate === null).slice(0, 1).map((a) => ({ id: a.id })) });
  type Expanded = ReturnType<typeof expand>;
  type Client = {
    unit: { findMany(args: ReadArgs): Promise<Expanded[]>; findFirst(args: ReadArgs): Promise<Expanded | null> };
    tenantAssignment: { findFirst(args: ReadArgs): Promise<Partial<TenantAssignment> | null> };
    $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
    $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
    $transaction<Result>(work: (tx: Client) => Promise<Result>, options: { isolationLevel: string; timeout: number }): Promise<Result>;
    ledgerEntry: { findMany(args: ReadArgs): Promise<(LedgerRow & { payment: Partial<Payment> | null })[]>; createMany(args: { data: FeeInsert[]; skipDuplicates?: boolean }): Promise<{ count: number }> };
    payment: { findMany(args: ReadArgs): Promise<Partial<Payment>[]> };
    auditLog: { findMany(args: ReadArgs): Promise<Partial<AuditLog>[]>; count(args: ReadArgs): Promise<number> };
  };
  const prisma: Client = {
    unit: {
      findMany: async ({ where }: ReadArgs) => { const selected = state.units.filter((u) => match(u, where)).map(expand);
        events.push("candidate.read"); if (controls.snapshotBarrier) await controls.snapshotBarrier(); return selected; },
      findFirst: async ({ where }: ReadArgs) => { events.push("unit.read"); const unit = state.units.find((u) => match(u, where)); return unit ? expand(unit) : null; },
    },
    tenantAssignment: { findFirst: async ({ where }: ReadArgs) => { assert.ok(inTransaction); events.push("assignment.read"); return state.assignments.find((a) => match(a, where)) ?? null; } },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => { assert.ok(inTransaction); events.push("advisory:" + values.join(":")); return 1; },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => { assert.ok(inTransaction); const sql = strings.join("?");
      assert.ok(sql.includes("NOWAIT")); events.push(sql); if (controls.onLock) await controls.onLock(sql, values); return []; },
    $transaction: async <Result>(fn: (tx: Client) => Promise<Result>, options: { isolationLevel: string; timeout: number }): Promise<Result> => {
      const previous = tail; let release!: () => void; tail = new Promise<void>(r => release = r); await previous;
      assert.equal(options.isolationLevel, "ReadCommitted"); assert.equal(options.timeout, 20000);
      const saved = structuredClone(state); inTransaction = true; attempts++; events.push("begin");
      try { return await fn(prisma); }
      catch (error) { Object.assign(state, saved); events.push("rollback"); throw error; }
      finally { inTransaction = false; release(); }
    },
    ledgerEntry: {
      findMany: async ({ where }: ReadArgs) => {
        const history = where.OR?.some((part) => part.chargeType || part.idempotencyKey);
        if (history) { assert.ok(inTransaction); assert.ok(events.some(e => e.includes('FROM "Property"'))); events.push("history.read"); }
        else { events.push("financial.read"); if (controls.financialHook) controls.financialHook(inTransaction); }
        return state.ledger.filter((r) => match(r, where)).map((r) => ({ ...r,
          payment: r.paymentId ? state.payments.find((p) => p.id === r.paymentId) ?? null : null }));
      },
      createMany: async (args: { data: FeeInsert[]; skipDuplicates?: boolean }) => {
        assert.ok(inTransaction); assert.equal(args.skipDuplicates, undefined); assert.ok(events.includes("history.read")); events.push("batch.insert");
        for (let index = 0; index < args.data.length; index++) {
          const data = args.data[index];
          if (state.ledger.some((r) => r.idempotencyKey && r.idempotencyKey === data.idempotencyKey)) throw { code: "P2002" };
          state.ledger.push({ id: "fee" + (++sequence), createdAt: new Date("2026-10-06"), voidedAt: null, ...data });
          if (controls.fault) await controls.fault(index, args.data);
        }
        return { count: args.data.length };
      },
    },
    payment: { findMany: async ({ where }: ReadArgs) => state.payments.filter((p) => match(p, where)) },
    auditLog: {
      findMany: async ({ where }: ReadArgs) => { assert.ok(inTransaction); return state.audits.filter((a) => match(a, where)); },
      count: async ({ where }: ReadArgs) => state.audits.filter((a) => match(a, where)).length,
    },
  };
  const dates: typeof import("../lib/rentDates") = load("lib/rentDates.ts", {});
  const calendar = load("lib/billingCalendar.ts", { "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma }, "@/lib/rentDates": dates });
  const ledger = load("lib/ledger.ts", { "@/lib/prisma": { prisma } });
  const financial = load("lib/unitFinancialState.ts", {
    "@/lib/billingConfig": load("lib/billingConfig.ts", {}), "@/lib/ledger": ledger,
    "@/lib/rentDates": dates, "@/lib/unitStatusEngine": load("lib/unitStatusEngine.ts", {}), "@/lib/billingCalendar": calendar,
  });
  const imports = { "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma },
    "@/lib/billingCalendar": calendar, "@/lib/rentDates": dates, "@/lib/unitFinancialState": financial,
    "@/lib/manualFinancialOperations": load("lib/manualFinancialOperations.ts", {}) };
  const job = (): typeof import("../jobs/lateFees").runLateFeesJob => load("jobs/lateFees.ts", imports).runLateFeesJob;
  const run = (asOf = new Date("2026-10-06T17:00:00Z")) => job()(asOf, "p");
  const add = (extra: Partial<LedgerRow> = {}) => { const row = { id: "history" + (++sequence), propertyId: "p", unitId: "u",
    tenantAssignmentId: "a", billingCycle: "2026-10", entryType: "CHARGE", chargeType: "LATE_FEE_INITIAL",
    amountCents: 500, effectiveDate: dates.getBusinessDateInstant("2026-10-03"), createdAt: new Date("2026-10-03"),
    idempotencyKey: null, memo: null, voidedAt: null, ...extra }; state.ledger.push(row); return row; };
  add({ id: "rent", chargeType: "RENT", amountCents: 10000, effectiveDate: dates.getBusinessDateInstant("2026-10-01") });
  const fees = () => state.ledger.filter((r) => r.chargeType?.startsWith("LATE_FEE"));
  const manualAudit = (row: LedgerRow, extra: Partial<AuditLog> = {}) => { const audit = { propertyId: row.propertyId,
    actorType: "MANAGER", action: "MANUAL_CHARGE_POSTED", targetType: "LEDGER_ENTRY", targetId: row.id,
    metadataJson: JSON.stringify({ unitId: row.unitId, tenantAssignmentId: row.tenantAssignmentId,
      entryType: row.entryType, chargeType: row.chargeType, amountCents: row.amountCents, effectiveDate: row.effectiveDate.toISOString() }), ...extra };
    state.audits.push(audit); return audit; };
  return { state, controls, events, property, tiers, prisma, dates, imports, run, job, add, fees, manualAudit, attempts: () => attempts };
}
