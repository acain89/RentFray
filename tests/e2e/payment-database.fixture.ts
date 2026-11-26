import assert from "node:assert/strict";
import type { Payment, LedgerEntry, AuditLog, Property } from "@prisma/client";
import { isRecord } from "../fixture-assertions";
export type StoredPayment = Partial<Payment> & { id: string };
export type StoredLedger = Partial<LedgerEntry> & { id: string };
export type StoredAudit = Partial<AuditLog> & { id: string };
export type PaymentDatabase = {
 payments: StoredPayment[]; ledger: StoredLedger[]; audits: StoredAudit[];
 property: Partial<Property> & Pick<Property, "id" | "status" | "isActive">;
 balance: number; fee: number; failAudit: boolean; useLedgerBalance?: boolean;
};
type Args = { where?: unknown; select?: unknown; include?: unknown; orderBy?: unknown; take?: number };
type PaymentProjection = { payment?: { status: Payment["status"] | undefined } | null };
type Table<Row extends object> = {
 findFirst(args: Args): Promise<Row | null>; findUnique(args: Args): Promise<Row | null>;
 findMany(args?: Args): Promise<(Row & PaymentProjection)[]>;
 create(args: { data: Partial<Row> }): Promise<Row>;
 update(args: { where: unknown; data: Partial<Row> }): Promise<Row>;
 updateMany(args: { where: unknown; data: Partial<Row> }): Promise<{ count: number }>;
 upsert(args: { where: unknown; create: Partial<Row>; update: Partial<Row> }): Promise<Row>;
};
type UnitFixture = {
 id: string; unitNumber: string; propertyId: string; tier: null;
 tenantAssignments: { id: string }[];
 property: PaymentDatabase["property"] & { name: string; stripeAccountId: string; settings: object; paymentStatus: object; units: unknown[]; rentFrayStartDate: null };
};
export type PaymentClient = {
 payment: Table<StoredPayment>; ledgerEntry: Table<StoredLedger>; auditLog: Table<StoredAudit>;
 unit: { findFirst(args: Args): Promise<UnitFixture | null> };
 tenantAssignment: { findFirst(args: Args): Promise<{ id: string } | null> };
 property: { updateMany(args: { where: unknown; data: Partial<PaymentDatabase["property"]> }): Promise<{ count: number }> };
 $transaction<Result>(work: (tx: PaymentClient & { $executeRaw(strings: TemplateStringsArray, key: string): Promise<void> }) => Promise<Result>): Promise<Result>;
};
function match(row: unknown, where: unknown, greaterThan: boolean): boolean {
 if (where === undefined) return true;
 assert.ok(isRecord(where));
 return Object.entries(where).every(([key, wanted]) => {
  if (key === "OR" || key === "AND") { assert.ok(Array.isArray(wanted)); return key === "OR" ? wanted.some((part: unknown) => match(row, part, greaterThan)) : wanted.every((part: unknown) => match(row, part, greaterThan)); }
  assert.ok(isRecord(row)); const field = row[key];
  if (isRecord(wanted) && !(wanted instanceof Date)) {
   if ("in" in wanted) { assert.ok(Array.isArray(wanted.in)); const choices: unknown[] = wanted.in; return choices.includes(field); }
   if ("not" in wanted) return field !== wanted.not;
   if ("lte" in wanted) return typeof field === "string" && typeof wanted.lte === "string" ? field <= wanted.lte : Number(field) <= Number(wanted.lte);
   if (greaterThan && "gt" in wanted) return field != null && (typeof field === "string" && typeof wanted.gt === "string" ? field > wanted.gt : Number(field) > Number(wanted.gt));
  }
  return field === wanted;
 });
}
export function paymentClient(get: () => PaymentDatabase, replace: (value: PaymentDatabase) => void, options: {
 date: Date; greaterThan: boolean; currentAssignment: boolean;
 onCommitted?: (rows: StoredPayment[]) => void;
}) {
 let sequence = 0, tail = Promise.resolve();
 const lockKeys: string[] = [];
 function table<Row extends object>(rows: () => Row[], name: string, make: (data: Partial<Row>) => Row): Table<Row> {
  const delegate: Table<Row> = {
   findFirst: async args => structuredClone(rows().find(row => match(row, args.where, options.greaterThan)) ?? null),
   findUnique: async args => structuredClone(rows().find(row => match(row, args.where, options.greaterThan)) ?? null),
   findMany: async (args = {}) => rows().filter(row => match(row, args.where, options.greaterThan)).map(row => {
    const id: unknown = Reflect.get(row, "paymentId");
    return { ...structuredClone(row), ...(name === "ledger" ? { payment: id ? { status: get().payments.find(payment => payment.id === id)?.status } : null } : {}) };
   }),
   create: async ({ data }) => {
    if (name === "audits" && get().failAudit) throw new Error("Injected DB failure");
    const key: unknown = Reflect.get(data, "idempotencyKey");
    if (key && rows().some(row => Reflect.get(row, "idempotencyKey") === key)) throw new Error("Unique ledger key");
    const row = make(structuredClone(data)); rows().push(row); return structuredClone(row);
   },
   update: async ({ where, data }) => { const row = rows().find(row => match(row, where, options.greaterThan)); if (!row) throw new Error("Not found"); Object.assign(row, structuredClone(data)); return structuredClone(row); },
   updateMany: async ({ where, data }) => { const selected = rows().filter(row => match(row, where, options.greaterThan)); selected.forEach(row => Object.assign(row, structuredClone(data))); return { count: selected.length }; },
   upsert: async ({ where, create, update }) => rows().some(row => match(row, where, options.greaterThan)) ? delegate.update({ where, data: update }) : delegate.create({ data: create }),
  }; return delegate;
 }
 const defaults = () => ({ id: "new-" + ++sequence, createdAt: options.date, voidedAt: null });
 const unit: UnitFixture = { id: "unit", unitNumber: "1", propertyId: "property", tier: null, tenantAssignments: [{ id: "historical" }],
  property: { ...get().property, name: "Test", stripeAccountId: "acct", settings: {}, paymentStatus: {}, units: [], rentFrayStartDate: null } };
 const assignment = { id: "historical", propertyId: "property", unitId: "unit", ...(options.currentAssignment ? { isCurrent: true, moveOutDate: null } : {}) };
 const client: PaymentClient = {
  payment: table(() => get().payments, "payments", data => ({ ...defaults(), ...data })),
  ledgerEntry: table(() => get().ledger, "ledger", data => ({ ...defaults(), ...data })),
  auditLog: table(() => get().audits, "audits", data => ({ ...defaults(), ...data })),
  unit: { findFirst: async ({ where }) => match(unit, where, options.greaterThan) ? structuredClone(unit) : null },
  tenantAssignment: { findFirst: async ({ where }) => match(assignment, where, options.greaterThan) ? { id: "historical" } : null },
  property: { updateMany: async ({ where, data }) => { if (match(get().property, where, options.greaterThan)) Object.assign(get().property, data); return { count: 1 }; } },
  $transaction: async <Result>(fn: (tx: PaymentClient & { $executeRaw(strings: TemplateStringsArray, key: string): Promise<void> }) => Promise<Result>): Promise<Result> => {
   let release: (() => void) | undefined, snapshot: PaymentDatabase | undefined;
   const tx = { ...client, $executeRaw: async (_strings: TemplateStringsArray, key: string) => {
    lockKeys.push(key);
    if (!release) { const previous = tail; tail = new Promise<void>(resolve => { release = resolve; }); await previous; snapshot = structuredClone(get()); options.onCommitted?.(structuredClone(get().payments)); }
   } };
   try { const result = await fn(tx); options.onCommitted?.(structuredClone(get().payments)); return result; }
   catch (error) { if (snapshot) replace(snapshot); throw error; }
   finally { release?.(); }
  },
 };
 return { client, unit, lockKeys };
}
