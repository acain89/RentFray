import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve(__dirname, "..");
const file = "app/admin/properties/[id]/setup/page.tsx";
const current = readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
const baseline = execFileSync("git", ["show", "5da580d96891dabaa4926e661d6f44b23f7a5ae8:" + file], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
test("ADMIN setup has no manual payment controls or submission", () => {
  for (const obsolete of ["savePaymentStatus", "Save Payment Status", "setStripeConnected", "setAchEnabled", "setAdminApproved", "paymentNotes", "type=\"checkbox\"", "/payment-status"])
    assert.ok(!current.includes(obsolete), obsolete);
  for (const display of ["Live Readiness", "readiness?.stripeConnected", "readiness?.chargesEnabled", "readiness?.payoutsEnabled", "readiness?.readyForLive"])
    assert.ok(current.includes(display), display);
});
test("ADMIN setup retires obsolete saves and preserves lifecycle and overrides", () => {
  for (const [start, end] of [["  async function saveLifecycle()", "  async function runOverride"], ["  async function runOverride", "  if (loading"]]) {
    const before = baseline.slice(baseline.indexOf(start), baseline.indexOf(end));
    assert.equal(current.slice(current.indexOf(start), current.indexOf(end)).trim(), before.trim());
  }
  for (const label of ["Lifecycle", "FORCE_LIVE", "UNLOCK_UNIT", "REPAIR_PAYMENT_STATUS"])
    assert.ok(current.includes(label), label);
  for (const obsolete of ["Create Units", "Recurring Fees", "Save Setup", "saveSetup"]) assert.ok(!current.includes(obsolete), obsolete);
  assert.equal(current.includes("rentFrayStartDate"), baseline.includes("rentFrayStartDate"));
});
