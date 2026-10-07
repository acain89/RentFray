import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
const file = "app/admin/requests/page.tsx";
const source = readFileSync(resolve(file), "utf8");
test("RF-18 removes provisioning and both approval controls without changing remaining page", () => {
  const before = execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
  let expected = before.replace('import { Prisma } from "@prisma/client";\n', "");
  expected = expected.slice(0, expected.indexOf("function generateCode()")) + expected.slice(expected.indexOf("/* =========================\n   REJECT"));
  expected = expected.replace(/^[ ]*<form action=\{approveRequest\}[^\n]*>[\s\S]*?<\/form>\n\n/gm, "");
  assert.equal(source.replace(/\r\n/g, "\n"), expected);
  assert.doesNotMatch(source, /approveRequest|generateCode|property\.create|managementUser\.create|Approve/);
});
test("RF-18 retains only rejection as a server action and both rendered form targets", () => {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const actions: string[] = [];
  const forms: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.body?.statements.some(s => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === "use server")) actions.push(node.name!.text);
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "action") forms.push(node.initializer!.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.deepEqual(actions, ["rejectRequest"]);
  assert.deepEqual(forms, ["{rejectRequest}", "{rejectRequest}"]);
});
