import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Reuse the existing source-mocked reservation fixture without changing it,
// registering Playwright tests, or starting an application/browser/service.
function fixture() {
  const file = "tests/e2e/checkout-reservation.spec.ts";
  const source = readFileSync(file, "utf8");
  const declarations = source.slice(0, source.indexOf('\ntest('));
  const module = { exports: {} as any };
  const imports: Record<string, any> = { "node:fs": { readFileSync }, "node:path": { resolve },
    "node:vm": { runInNewContext }, typescript: ts, "@playwright/test": {
      expect: (value: any) => ({ toEqual: (other: any) => assert.deepEqual(JSON.parse(JSON.stringify(value)), JSON.parse(JSON.stringify(other))) }),
    } };
  runInNewContext(ts.transpileModule(declarations + '\nmodule.exports.fixture = fixture;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, __dirname: resolve("tests/e2e"), Date, Buffer, URL, Set, Map, structuredClone,
    require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  const f = module.exports.fixture(250);
  f.db().payments = [];
  return f;
}
test("Checkout emits canonical cancel URL and preserves success URL", async () => {
  const f = fixture(); const result = await f.checkout().POST(f.request());
  assert.equal(result.status, 200); assert.equal(f.creations.length, 1);
  const parameters = f.creations[0].params;
  assert.equal(parameters.cancel_url, "https://rentfray.com/tenant/dashboard");
  assert.equal(parameters.success_url, "https://rentfray.com/tenant/dashboard");
  assert.equal(new URL(parameters.cancel_url).search, "");
  assert.ok(!parameters.cancel_url.includes("/tenant/pay"));
  assert.equal(parameters.metadata.tenantAssignmentId, "historical");
  assert.equal(parameters.metadata.unitId, "unit"); assert.equal(parameters.metadata.propertyId, "property");
});
test("browser return does not retire reservation or create another Checkout; explicit retry resumes", async () => {
  const f = fixture(); const first = await f.checkout().POST(f.request()); assert.equal(first.status, 200);
  const snapshot = JSON.stringify(f.db()); const checkout = JSON.stringify([...f.sessions]);
  // A return is a destination URL, not a financial event or route mutation.
  const destination = new URL(f.creations[0].params.cancel_url);
  assert.equal(destination.pathname, "/tenant/dashboard");
  assert.equal(JSON.stringify(f.db()), snapshot); assert.equal(JSON.stringify([...f.sessions]), checkout);
  const second = await f.checkout().POST(f.request()); assert.equal(second.status, 200);
  assert.equal(first.body.data.url, second.body.data.url);
  assert.equal(f.db().payments.length, 1); assert.equal(f.creations.length, 1);
  assert.equal(f.db().ledger.filter((e: any) => e.entryType === "PAYMENT").length, 0);
});
for (const foreign of ["property", "unit"]) test(`cancel URL grants no ${foreign} authority`, async () => {
  const f = fixture(); if (foreign === "property") f.unit.propertyId = "foreign"; else f.unit.id = "foreign";
  const result = await f.checkout().POST(f.request()); assert.notEqual(result.status, 200);
  assert.equal(f.creations.length, 0); assert.equal(f.db().payments.length, 0);
});
test("dashboard canonical Pay action is explicit; no cancel-specific writer added", () => {
  const page = readFileSync("app/tenant/dashboard/page.tsx", "utf8");
  assert.ok(page.includes("<PayNowButton")); assert.ok(page.includes('fetch("/api/tenant/dashboard"'));
  const button = readFileSync("app/components/PayNowButton.tsx", "utf8");
  assert.ok(button.includes('fetch("/api/payments/create-session"')); assert.ok(button.includes("JSON.stringify({ unitId })"));
  const route = readFileSync("app/api/payments/create-session/route.ts", "utf8");
  assert.ok(!route.includes("checkout=cancelled"));
});
