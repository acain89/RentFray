import { test } from "node:test";
import assert from "node:assert/strict";
import { detailFixture, nodes, textOf } from "./manager-unit-detail-financial-consistency.test";

const payment = (assignment: string | null, status = "PAID", amountCents = 99999) => ({
  id: "pay", propertyId: "p", unitId: "u", tenantAssignmentId: assignment, status, amountCents,
  createdAt: new Date("2026-10-01"), paidAt: status === "PAID" ? new Date("2026-10-01") : null,
  processingFeeCents: 0, paymentMethod: "UNIQUE-HISTORICAL-METHOD" });
test("replacement tenant gets no historical/null/foreign payment metadata", async () => {
  const f = detailFixture(); f.unit.payments = [payment("a"), payment(null), { ...payment("b"), propertyId: "foreign" }];
  const text = textOf(await f.render()); assert.ok(!text.includes("999.99")); assert.ok(!text.includes("UNIQUE-HISTORICAL-METHOD"));
  const links = nodes(await f.render()).map(n => n.props?.href).filter(Boolean);
  assert.ok(links.includes("/manager/units/u/history")); assert.ok(links.includes("/api/exports/payments?unitId=u"));
  assert.ok(links.includes("/api/exports/ledger?unitId=u")); assert.equal(f.unit.payments.length, 3);
});
for (const status of ["PAID", "PENDING", "FAILED", "REVERSED"]) test(`current ${status} activity versus completed payment`, async () => {
  const f = detailFixture(); f.unit.payments = [payment("b", status, 8765)]; const tree = await f.render();
  assert.ok(textOf(tree).includes("$87.65"));
  const strings = nodes(tree).filter(n => typeof n === "string");
  assert.equal(strings.filter(s => s === "$87.65").length, status === "PAID" ? 3 : 1);
});
test("null accounting remains canonical while historical private rows are excluded", async () => {
  const f = detailFixture(); f.unit.ledgerEntries = [
    { id: "null", tenantAssignmentId: null, effectiveDate: new Date("2026-08-01"), memo: "Unit obligation", amountCents: 700, entryType: "CHARGE", chargeType: "LATE_FEE" },
    { id: "a", tenantAssignmentId: "a", effectiveDate: new Date("2026-10-01"), memo: "Prior private memo", amountCents: 900 },
    { id: "ambiguous", tenantAssignmentId: null, effectiveDate: new Date("2026-10-01"), memo: "Ambiguous payment memo", amountCents: -900, entryType: "PAYMENT", payment: payment(null) },
  ]; const text = textOf(await f.render()); assert.ok(text.includes("Unit obligation")); assert.ok(text.includes("LATE_FEE"));
  assert.ok(!text.includes("Prior private memo")); assert.ok(!text.includes("Ambiguous payment memo")); assert.ok(text.includes("$123.45"));
  assert.equal(f.unit.ledgerEntries.length, 3);
});
test("vacancy, cross-property denial and current action bindings", async () => {
  const f = detailFixture(); f.unit.payments = [payment("a")]; let tree = await f.render();
  const controls = nodes(tree).filter(n => f.controls.includes(n.type));
  assert.equal(controls.find(n => n.type === f.controls[0]).props.tenantAssignmentId, "b");
  assert.equal(controls.find(n => n.type === f.controls[1]).props.tenantId, "b");
  assert.ok(textOf(await f.render("foreign")).includes("Unit not found"));
  f.unit.tenantAssignments = []; tree = await f.render(); assert.ok(!textOf(tree).includes("999.99"));
});
