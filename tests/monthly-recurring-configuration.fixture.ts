import type { LedgerEntry, UnitRecurringFee } from "@prisma/client";
type LedgerRow = Partial<LedgerEntry> & { id: string; idempotencyKey: string; chargeType: string; amountCents: number };
type Insert = Omit<LedgerRow, "id">;

import assert from "node:assert/strict";
import { load, matches } from "./recurring-charge-configuration.fixture";


export function monthlyFixture(charges: (Omit<ReturnType<typeof charge>, "propertyId" | "sortOrder"> & Partial<Pick<ReturnType<typeof charge>, "propertyId" | "sortOrder">>)[] = []) {
  const calendar = load("lib/rentDates.ts", {});
  const ledger: LedgerRow[] = [];
  const unit = { id: "u", propertyId: "p", unitNumber: "1", isActive: true, tierId: "t",
    property: { id: "p", rentFrayStartDate: new Date("2026-10-01T00:00:00Z"), settings: { rentDueDay: 1 } },
    tier: { id: "t", rentDueDay: 1, baseRentCents: 0 },
    tenantAssignments: [{ id: "assignment", moveInDate: new Date("2026-09-01T12:00:00Z"), isCurrent: true }] as { id: string; moveInDate: Date | null; isCurrent?: boolean }[], recurringFeeItems: [] as Pick<UnitRecurringFee, "id" | "label" | "amountCents" | "createdAt">[] };
  const events: string[] = [];
  const controls = { failStage: "", failLock: false, failCommit: false, onLock: undefined as undefined | (() => void | Promise<void>), onRead: undefined as undefined | (() => void | Promise<void>), missingUnit: false, missingProperty: false, commitErrors: [] as unknown[] };
  const tails = new Map<string, Promise<void>>();
  let propertyTail = Promise.resolve();
  async function acquireProperty() {
    const previous = propertyTail; let release!: () => void;
    propertyTail = new Promise<void>(resolve => { release = resolve; });
    await previous; return release;
  }
  async function mutate(change: () => void) {
    events.push("writer:wait"); const release = await acquireProperty();
    try { events.push("writer:locked"); change(); events.push("writer:commit"); }
    finally { release(); }
  }
  const db = {

    unit: { findMany: async ({ cursor }: { cursor?: { id: string } }) => cursor ? [] : unit.isActive ? [unit] : [] },
    propertyTierCharge: { findMany: async ({ where }: { where: unknown }) => charges.filter(r => matches(r, where)) },
    ledgerEntry: {
      findMany: async ({ where }: { where: unknown }) => ledger.filter(r => matches(r, where)),
      createMany: async ({ data, skipDuplicates }: { data: Insert[]; skipDuplicates: boolean }) => {
        assert.equal(skipDuplicates, true); let count = 0;
        for (const row of data) if (!ledger.some(r => r.idempotencyKey === row.idempotencyKey)) {
          ledger.push({ id: "ledger-" + ledger.length, voidedAt: null, ...row }); count++;
        }
        return { count };
      },
    },
  };
  type Transaction = {
    $executeRaw(sql: TemplateStringsArray, namespace: number, key: string): Promise<number>;
    $queryRaw(sql: TemplateStringsArray, propertyId: string): Promise<{ id: string }[]>;
    unit: { findFirst(): Promise<{ propertyId: string } | null>; findMany(): Promise<typeof unit[]> };
    propertyTierCharge: typeof db.propertyTierCharge;
    ledgerEntry: typeof db.ledgerEntry;
  };
  const database = {
    unit: { findMany: db.unit.findMany },
    $transaction: async <Result>(work: (tx: Transaction) => Promise<Result>, options: { timeout: number; isolationLevel: string }): Promise<Result> => {
      assert.equal(options.timeout, 30000); assert.equal(options.isolationLevel, "ReadCommitted");
      let staged: LedgerRow[] = []; let release: (() => void) | undefined; let propertyRelease: (() => void) | undefined; let locked = false;
      const tx = {
        $executeRaw: async (sql: TemplateStringsArray, namespace: number, key: string) => {
          const text = sql.join("?");
          assert.ok(text.includes("pg_advisory_xact_lock"));
          assert.ok(!text.includes("pg_try_advisory_lock"));
          assert.equal(namespace, 91024001);
          if (controls.failLock) throw Error("lock failure");
          const previous = tails.get(key) ?? Promise.resolve();
          const gate = new Promise<void>(resolve => { release = resolve; });
          tails.set(key, previous.then(() => gate));
          await previous; locked = true; events.push("lock:" + key);
          await controls.onLock?.(); staged = structuredClone(ledger); return 1;
        },
        $queryRaw: async (sql: TemplateStringsArray, propertyId: string) => {
          assert.ok(locked); assert.match(sql.join("?"), /FROM "Property"[\s\S]*FOR UPDATE/);
          assert.equal(propertyId, unit.propertyId);
          propertyRelease = await acquireProperty(); events.push("property:lock"); staged = structuredClone(ledger);
          return controls.missingProperty ? [] : [{ id: propertyId }];
        },
        unit: {
          findFirst: async () => { assert.ok(locked); events.push("unit:identity"); return controls.missingUnit ? null : { propertyId: unit.propertyId }; },
          findMany: async () => { assert.ok(locked); events.push("unit:read"); const snapshot = structuredClone(unit);
            await controls.onRead?.(); return !controls.missingUnit && snapshot.isActive ? [snapshot] : []; },
        },
        propertyTierCharge: { findMany: async (query: Parameters<typeof db.propertyTierCharge.findMany>[0]) => { assert.ok(locked); events.push("tier:read"); return structuredClone(await db.propertyTierCharge.findMany(query)); } },
        ledgerEntry: {
          findMany: async ({ where }: { where: unknown }) => { assert.ok(locked); events.push("ledger:read"); return staged.filter(row => matches(row, where)); },
          createMany: async ({ data, skipDuplicates }: { data: Insert[]; skipDuplicates: boolean }) => {
            assert.ok(locked); assert.equal(skipDuplicates, true); events.push("ledger:write");
            let count = 0;
            for (const row of data) {
              const stage = row.chargeType === "RENT" ? "rent" : row.idempotencyKey.startsWith("UNIT_") ? "unit" : "tier";
              if (controls.failStage === stage) throw Error(stage + " insertion failure");
              if (!staged.some(existing => existing.idempotencyKey === row.idempotencyKey)) {
                staged.push({ id: "ledger-" + staged.length, voidedAt: null, ...row }); count++;
              }
            }
            return { count };
          },
        },
      };
      try {
        const result = await work(tx);
        if (controls.failCommit) throw Error("commit failure");
        if (controls.commitErrors.length) throw controls.commitErrors.shift();
        ledger.splice(0, ledger.length, ...staged); events.push("commit"); return result;
      } catch (error) { events.push("rollback"); throw error; }
      finally { propertyRelease?.(); release?.(); }
    },
  };
  const job = load("jobs/monthlyRent.ts", { "@/lib/prisma": { prisma: database }, "@prisma/client": { Prisma: { TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" } } }, "@/lib/manualFinancialOperations": load("lib/manualFinancialOperations.ts", {}),
    "@/lib/rentDates": calendar, "@/lib/billingCalendar": { assertTierBillingCalendar: () => 1, BillingCalendarError: class extends Error {} } });
  return { unit, ledger, events, controls, mutate, run: (asOf: Date) => job.runMonthlyRentJob(asOf, "p") };
}
export const charge = (id: string, amountCents: number, effectiveDate: Date, effectiveUntil: Date | null = null, tierId = "t") =>
  ({ id, propertyId: "p", tierId, label: "Same label", amountCents, effectiveDate, effectiveUntil, isActive: true, sortOrder: 0 });
