import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Reuse the existing isolated route fixture without changing it or contacting services.
function fixture() {
  const source = readFileSync("tests/financial-export-contracts.test.ts", "utf8").split('for (const alias of ["month", "billingCycle", "cycle"])')[0];
  const module = { exports: {} as any };
  runInNewContext(ts.transpileModule(source + "\nexport { fixture };", { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, require, Date, Intl, URL, Buffer, console });
  return module.exports.fixture();
}
function parse(csv: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (ch === "," || ch === "\n")) {
      row.push(cell); cell = "";
      if (ch === "\n") { rows.push(row); row = []; }
    } else cell += ch;
  }
  row.push(cell); rows.push(row); assert.equal(quoted, false);
  const headers = rows.shift()!;
  return rows.map(values => { assert.equal(values.length, headers.length); return Object.fromEntries(headers.map((h, i) => [h, values[i]])); });
}
const cases = ["=1+1", "+SUM(A1:A2)", "-1+1", "@SUM(A1:A2)", "  =1+1", "\t=1+1", "\u0001\r=1+1", "＝1+1", "Ordinary text", "", "A, B", 'A "quote"', "A\nB", "A\rB", "José 日本", '=HYPERLINK("x","y")'];
const unsafe = (s: string) => /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@＝＋－＠]/u.test(s);
for (const route of ["balances", "ledger", "payments"]) for (const value of cases) test(`${route} safely serializes text ${JSON.stringify(value)}`, async () => {
  const f = fixture(); const unit = f.units[0]; f.units.splice(1);
  unit.unitNumber = value; unit.property.name = value; unit.property.propertyCode = value; unit.tier.name = value;
  unit.tenantAssignments[0].firstName = value; unit.tenantAssignments[0].lastName = "";
  const attribution = { firstName: value, lastName: "" };
  f.entry("ADJUSTMENT", -50000, { tenantAssignment: attribution, memo: value, referenceNumber: value });
  f.payment("PAID", { tenantAssignment: attribution, amountCents: 100000, memo: value, referenceNumber: value });
  const reply = await f.get(route, "unitId=u1"); assert.equal(reply.status, 200);
  const rows = parse(reply.body); assert.ok(rows.length > 0);
  const expected = (s: string) => unsafe(s) ? "'" + s : s;
  for (const row of rows) {
    for (const column of ["unitNumber", "propertyName", "propertyCode", "tierName", "memo", "referenceNumber"]) {
      if (column in row) assert.equal(row[column], expected(value), column);
    }
    assert.equal(row.tenantName, expected(value.trim()));
    for (const [key, cell] of Object.entries(row)) if (/Cents$/.test(key) || ["amount", "fee", "totalPaid", "currentBalance", "signedImpact", "runningBalance"].includes(key)) {
      assert.equal(cell.startsWith("'"), false, key);
    }
  }
  // Only output changes: stored values remain intact.
  assert.equal(unit.unitNumber, value); assert.equal(f.entries[0].memo, value);
});

test("typed positive, zero and negative financial cells preserve existing numeric encoding", async () => {
  const f = fixture();
  for (const amount of [100000, 0, -50000]) f.entry("ADJUSTMENT", amount);
  const rows = parse((await f.get("ledger", "unitId=u1")).body);
  assert.deepEqual(rows.map(r => r.amount), ["1000.00", "0.00", "-500.00"]);
  assert.deepEqual(rows.map(r => r.amountCents), ["100000", "0", "-50000"]);
});
