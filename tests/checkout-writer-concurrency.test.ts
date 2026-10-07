import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkoutFixture } from "./checkout-collectibility.test";
import { writerFixture } from "./checkout-writer-guards.test";
for (const mutation of ["new", "removed", "status", "session", "intent", "amount", "cycle", "additional"]) test("locked inventory rejects " + mutation + " between inspection and mutation", async () => {
  const f = checkoutFixture(), a = f.add("expired"); const proof = await f.inspect();
  if (mutation === "new" || mutation === "additional") f.add("open", "two");
  if (mutation === "removed") f.rows.splice(0);
  if (mutation === "status") a.p.status = "PAID";
  if (mutation === "session") a.p.stripeSessionId = "new";
  if (mutation === "intent") a.p.stripePaymentIntentId = "new";
  if (mutation === "amount") a.p.amountCents++;
  if (mutation === "cycle") a.p.billingCycle = "2026-10";
  await f.helper.lockCheckout(f.db, f.identity); await assert.rejects(f.guard(proof), (e: any) => e.status === 409 && e.message.includes("changed"));
});
for (const kind of ["payment", "credit", "tier", "vacancy", "unlock"]) test(kind + " detects reservation inserted after external inspection and rolls back all writer effects", async () => {
  const f = writerFixture(kind === "unlock" ? "ADMIN" : "MANAGER"), a = f.add("expired");
  const execute = f.prisma.$executeRaw; let inserted = false;
  f.prisma.$executeRaw = async (...args: any[]) => { if (!inserted && String(args[1]) === "p:u:a") { inserted = true; f.add("open", "race"); } return execute(...args); };
  const response = await f.invoke(kind); assert.equal(response.status, 409); assert.ok(response.body.error.includes("changed"));
  assert.equal(f.state.ledgerEntry.length, 0); assert.equal(f.state.auditLog.length, 0); assert.equal(f.state.units[0].tenantPinHash, "tenant-pin"); assert.equal(f.state.units[0].tierId, "s"); assert.equal(f.state.tenantAssignment[0].isCurrent, true);
});
test("same assignment serialization waits for settlement; stale proof cannot authorize reduction", async () => {
  const f = writerFixture(); f.add("expired");
  let entered!: () => void, release!: () => void; const locked = new Promise<void>(r => entered = r), held = new Promise<void>(r => release = r);
  const settle = f.prisma.$transaction(async (tx: any) => { await f.c.helper.lockCheckout(tx, f.c.identity); entered(); await held; f.state.payment[0].status = "PAID"; }, { isolationLevel: "ReadCommitted" });
  await locked; const reduction = f.invoke("credit"); await new Promise(r => setTimeout(r, 0)); release(); await settle;
  assert.equal((await reduction).status, 409); assert.equal(f.state.ledgerEntry.length, 0); assert.equal(f.state.payment[0].status, "PAID");
});
test("new inspection and all advisory locks precede ordinary row locks", async () => {
  const f = writerFixture(); f.add("expired"); assert.equal((await f.invoke("payment")).status, 200);
  const firstRow = f.events.findIndex(e => e.includes('FOR UPDATE')); const assignmentLock = f.events.findIndex(e => e === "advisory:p:u:a");
  assert.ok(assignmentLock >= 0 && assignmentLock < firstRow); assert.equal(f.c.calls.filter(c => c.startsWith("checkout:")).length, 1);
  const webhook = readFileSync(resolve(__dirname, "../app/api/stripe/webhook/route.ts"), "utf8");
  assert.ok(webhook.includes('`${payment.propertyId}:${payment.unitId}:${payment.tenantAssignmentId ?? "none"}`'));
});
