import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import type { ReactNode } from "react";

const file = "app/terms/page.tsx";
const source = readFileSync(file, "utf8");
const original = execFileSync("git", ["show", "58cd0911d3e85e24e5eb99e8da8dff76132c7b1a:" + file], { encoding: "utf8" });
const fixture: { exports: unknown } = { exports: {} };
runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText, {
  module: fixture, exports: fixture.exports,
  require(name: string) { assert.equal(name, "react/jsx-runtime"); return jsx; },
});
const html = renderToStaticMarkup((fixture.exports as { default(): ReactNode }).default());
const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

test("approved refund policy preserves rights and distinguishes the platform fee", () => {
  for (const phrase of ["Management handles voluntary tenant refunds directly, outside RentFray", "does not offer discretionary manager-initiated refunds", "ordinarily retained after processing", "subject to applicable law", "does not change or erase the original platform payment record", "does not remove a payer's bank dispute rights", "legally required refunds", "Stripe fees and transferred funds may be reversed", "not a statement of Stripe's actual costs", "fee and total debit are shown before payment authorization"]) assert.ok(text.includes(phrase), phrase);
  assert.doesNotMatch(text, /fees are never refunded|transfers are never reversed/i);
});

test("existing authorization and all other Terms sections remain unchanged", () => {
  const before = original.replace(/\r\n/g, "\n");
  const after = source.replace(/\r\n/g, "\n");
  const marker = "3. Payments";
  const start = before.indexOf(marker);
  const end = before.indexOf("        </section>", start);
  const addedEnd = after.indexOf("        </section>", start);
  assert.equal(after.slice(0, end), before.slice(0, end));
  assert.equal(after.slice(addedEnd), before.slice(end));
  assert.ok(after.includes("By using RentFray, users authorize ACH and related payment"));
});
