import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { source, response, root } from "./required-audit-atomicity.test";

for (const payload of [undefined, {}, "malformed-json", { account: { email: "owner@example.invalid", password: "test-password" },
  property: { name: "Property" }, tiers: [{ name: "Tier", price: 100, unitCount: 1 }] }, { password: "plain:test-password" }]) {
  test("legacy public setup returns 410 without processing " + JSON.stringify(payload), async () => {
    let parsed = 0;
    // Only NextResponse is available. Any database/session/email/hash import fails closed.
    const api = source("app/api/setup/route.ts", { "next/server": response });
    const result = await api.POST({ json: async () => { parsed++; throw Error("Must not parse"); } });
    assert.equal(result.status, 410); assert.equal(parsed, 0);
    const body = JSON.stringify(result.body); assert.match(body, /retired/i);
    for (const secret of ["test-password", "passwordHash", "verificationToken", "plain:"]) assert.ok(!body.includes(secret));
  });
}
test("public signup continues to target the separate canonical route", () => {
  const page = readFileSync(resolve(root, "app/setup/page.tsx"), "utf8");
  assert.ok(page.includes('fetch("/api/setup/create-account"'));
  assert.ok(readFileSync(resolve(root, "app/api/setup/create-account/route.ts"), "utf8").includes("export async function POST"));
});
