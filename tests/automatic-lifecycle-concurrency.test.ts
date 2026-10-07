import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = resolve(__dirname, "..");
const helperModule = { exports: {} as any };
runInNewContext(ts.transpileModule(readFileSync(resolve(root, "lib/propertyStatus.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, { module: helperModule, exports: helperModule.exports });
const shouldAutoSetPropertyReady = helperModule.exports.shouldAutoSetPropertyReady;
function loadTransition(kind: string) {
  const source = readFileSync(resolve(root, "app/api/" + kind + "/dashboard/route.ts"), "utf8");
  const call = source.indexOf("shouldAutoSetPropertyReady({"); assert.ok(call >= 0);
  const start = source.lastIndexOf("if (", call); const open = source.indexOf(") {", call) + 2;
  assert.equal(source[open], "{"); let depth = 1; let end = open + 1;
  while (depth && end < source.length) { if (source[end] === "{") depth++; if (source[end] === "}") depth--; end++; }
  assert.equal(depth, 0); const block = source.slice(start, end);
  return runInNewContext("(async function(property, prisma, shouldAutoSetPropertyReady) {" + block + "; return property.status; })");
}
function fixture(kind: string, initial = "SETUP", competing?: string) {
  const property: any = { id: "p", status: initial, isActive: true, settings: {}, units: [{}],
    paymentStatus: { processorConnected: true, chargesEnabled: true, payoutsEnabled: true } };
  let status = initial; let writes = 0; let attempts = 0; let reads = 0;
  const events: string[] = [];
  const prisma = { property: {
    updateMany: async ({ where, data }: any) => {
      assert.deepEqual(JSON.parse(JSON.stringify(where)), { id: "p", status: "SETUP" });
      assert.deepEqual(JSON.parse(JSON.stringify(data)), { status: "READY" }); attempts++; events.push("cas");
      if (competing) { status = competing; competing = undefined; events.push("explicit:" + status); }
      if (status !== where.status) return { count: 0 }; status = data.status; writes++; return { count: 1 };
    },
    findUnique: async ({ where, select }: any) => { assert.equal(where.id, "p"); assert.deepEqual(JSON.parse(JSON.stringify(select)), { status: true });
      reads++; events.push("reread"); return { status }; },
  } };
  const run = loadTransition(kind);
  return { property, events, run: () => run(property, prisma, shouldAutoSetPropertyReady),
    snapshot: () => ({ status, writes, attempts, reads }),
    second: () => run({ ...property, status: "SETUP" }, prisma, shouldAutoSetPropertyReady) };
}
for (const kind of ["manager", "tenant"]) {
  for (const status of ["SUSPENDED", "TEST", "LIVE", "READY"]) test(kind + ": newer " + status + " defeats stale automatic transition", async () => {
    const f = fixture(kind, "SETUP", status); assert.equal(await f.run(), status);
    assert.deepEqual(f.snapshot(), { status, writes: 0, attempts: 1, reads: 1 }); assert.equal(f.property.status, status);
    assert.equal(f.events.at(-1), "reread");
  });
  test(kind + ": unchanged SETUP transitions once without unnecessary reread", async () => {
    const f = fixture(kind); assert.equal(await f.run(), "READY");
    assert.deepEqual(f.snapshot(), { status: "READY", writes: 1, attempts: 1, reads: 0 });
  });
  for (const status of ["READY", "SUSPENDED", "TEST", "LIVE"]) test(kind + ": initial " + status + " does not attempt automatic transition", async () => {
    const f = fixture(kind, status); assert.equal(await f.run(), status);
    assert.deepEqual(f.snapshot(), { status, writes: 0, attempts: 0, reads: 0 });
  });
  test(kind + ": competing automatic requests write once, loser rereads READY", async () => {
    const f = fixture(kind); const results = await Promise.all([f.run(), f.second()]);
    assert.deepEqual(results, ["READY", "READY"]); assert.deepEqual(f.snapshot(), { status: "READY", writes: 1, attempts: 2, reads: 1 });
  });
  for (const prerequisite of ["isActive", "settings", "units", "processorConnected", "chargesEnabled", "payoutsEnabled"]) test(kind + ": readiness prerequisite remains required: " + prerequisite, async () => {
    const f = fixture(kind); if (prerequisite === "isActive") f.property.isActive = false;
    else if (prerequisite === "settings") f.property.settings = null;
    else if (prerequisite === "units") f.property.units = [];
    else f.property.paymentStatus[prerequisite] = false;
    assert.equal(await f.run(), "SETUP"); assert.equal(f.snapshot().attempts, 0);
  });
}
test("both production blocks guard READY and use authoritative status after zero rows", () => {
  for (const kind of ["manager", "tenant"]) {
    const source = readFileSync(resolve(root, "app/api/" + kind + "/dashboard/route.ts"), "utf8");
    assert.match(source, /where: \{ id: property.id, status: "SETUP" \}/);
    assert.match(source, /if \(transition.count === 1\)/);
    assert.match(source, /property.status = currentProperty.status/);
    assert.doesNotMatch(source, /await prisma.property.update\(\{[\s\S]*?data: \{ status: "READY" \}/);
  }
});
