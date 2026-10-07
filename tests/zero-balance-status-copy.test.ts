import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { getUnitStatus, type UnitStatusInput } from "../lib/unitStatusEngine";
import { detailFixture, textOf } from "./manager-unit-detail-financial-consistency.test";

const committed = execFileSync("git", ["--no-optional-locks", "show", "HEAD:lib/unitStatusEngine.ts"], { encoding: "utf8", windowsHide: true });
const moduleBefore = { exports: {} as any };
runInNewContext(ts.transpileModule(committed, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: moduleBefore, exports: moduleBefore.exports });
const before = (input: UnitStatusInput) => JSON.parse(JSON.stringify(moduleBefore.exports.getUnitStatus(input)));
const inputFor = (balanceCents: number, state = "NONE", pending = false): UnitStatusInput => ({
  balanceCents, hasFailedPayment: state === "FAILED", hasReversedPayment: state === "REVERSED",
  hasPendingPayment: pending, isDelinquent: false, isWithinGracePeriod: false,
});

for (const state of ["FAILED", "REVERSED"]) for (const balance of [0, -50000, 10000]) test(`${state} balance ${balance}: message only`, () => {
  const input = inputFor(balance, state); const actual = getUnitStatus(input); const old = before(input);
  assert.equal(actual.status, "FAILED"); assert.equal(actual.paymentStatus, "FAILED");
  assert.equal(actual.canAttemptPayment, balance > 0);
  assert.equal(actual.tenantMessage, balance > 0 ? old.tenantMessage : "Your payment failed or was reversed. No payment is currently due.");
  assert.deepEqual({ ...actual, tenantMessage: old.tenantMessage }, old);
});

for (const balance of [0, -50000, 10000]) for (const state of ["NONE", "FAILED", "REVERSED"]) test(`PENDING unchanged for ${state}, balance ${balance}`, () => {
  const input = inputFor(balance, state, true);
  assert.deepEqual(getUnitStatus(input), before(input));
  assert.equal(getUnitStatus(input).canAttemptPayment, false);
});

for (const balance of [0, -50000, 10000]) test("ordinary state unchanged at " + balance, () => {
  const input = inputFor(balance); assert.deepEqual(getUnitStatus(input), before(input));
});

for (const state of ["FAILED", "REVERSED"]) test("Unit Detail corrected shared zero-debt copy: " + state, async () => {
  const f = detailFixture("FAILED", "OWNER", async () => ({ ...f.state,
    ledgerBalanceCents: 0, tenantTotalDueCents: 0, status: getUnitStatus(inputFor(0, state)) }));
  const rendered = textOf(await f.render());
  assert.ok(rendered.includes("No payment is currently due."));
  assert.equal(rendered.includes("Please submit a new payment"), false);
  assert.equal(f.calls.length, 1);
});
