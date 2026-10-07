import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { runInNewContext } from "node:vm";
const file = "app/admin/requests/page.tsx";
const source = readFileSync(resolve(file), "utf8");
test("RF-18 removes provisioning and both approval controls without changing remaining page", () => {
  const before = execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
  assert.equal(source.replace(/\r\n/g, "\n"), before);
  assert.doesNotMatch(source, /approveRequest|generateCode|property\.create|managementUser\.create|Approve/);
});

function pageFixture(role: string | null = "ADMIN") {
  const calls: any[] = [];
  const request = { id: "request", propertyName: "Requested property", propertyType: "Apartment",
    address: "Address", contactName: "Contact", contactInfo: "contact@isolated.invalid",
    unitCount: 3, notes: "Request notes", createdAt: new Date("2026-10-01T12:00:00Z") };
  const forbidden = new Proxy({}, { get() { throw Error("SetupRequest must not provision application records"); } });
  const jsx = (type: any, props: any) => ({ type, props });
  const imports: Record<string, any> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/prisma": { prisma: { property: forbidden, managementUser: forbidden, setupRequest: {
      findMany: async (args: any) => { calls.push({ list: args }); return [request]; },
      delete: async (args: any) => { calls.push({ delete: args }); return request; },
    } } },
    "@/lib/session": { getSession: async () => role ? { role } : null,
      requireRole: async (expected: string) => { assert.equal(expected, "ADMIN"); if (role !== expected) throw Error("Unauthorized"); } },
    "next/navigation": { redirect: (path: string) => { throw Error("redirect:" + path); } },
  };
  const module = { exports: {} as any };
  runInNewContext(ts.transpileModule(source + "\nexport { rejectRequest };", { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module, exports: module.exports, Date,
    require(name: string) { assert.ok(name in imports, "Unmocked import " + name); return imports[name]; } });
  return { api: module.exports, calls, request };
}

test("RF-18 ADMIN listing preserves request projection and rendered information", async () => {
  const f = pageFixture(); const tree = await f.api.default();
  const args = JSON.parse(JSON.stringify(f.calls[0].list));
  assert.deepEqual(args.orderBy, { createdAt: "desc" });
  assert.deepEqual(Object.keys(args.select).sort(), Object.keys(f.request).sort());
  const rendered = JSON.stringify(tree);
  for (const field of ["propertyName", "propertyType", "address", "contactName", "contactInfo", "notes"] as const)
    assert.ok(rendered.includes(f.request[field]));
  assert.ok(rendered.includes("Units: ")); assert.ok(rendered.includes("Reject"));
  assert.ok(!rendered.includes("Approve"));
});

for (const role of [null, "OWNER", "MANAGER", "STAFF", "TENANT", "MAINTENANCE"]) {
  test("RF-18 rejects listing and rejection by " + role, async () => {
    const f = pageFixture(role);
    await assert.rejects(f.api.default(), /redirect:\/login\/admin/);
    await assert.rejects(f.api.rejectRequest({ get: () => "request" }), /Unauthorized/);
    assert.equal(f.calls.length, 0);
  });
}
test("RF-18 rejection deletes only the selected request then redirects", async () => {
  const f = pageFixture();
  await assert.rejects(f.api.rejectRequest({ get: (name: string) => { assert.equal(name, "id"); return " request "; } }), /redirect:\/admin\/requests/);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [{ delete: { where: { id: "request" } } }]);
});
test("RF-18 rejection rejects a missing request ID without deleting anything", async () => {
  const f = pageFixture(); await assert.rejects(f.api.rejectRequest({ get: () => " " }), /Missing request id/);
  assert.equal(f.calls.length, 0);
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
