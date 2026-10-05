import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const routes = ["app/manager/maintenance/update/route.ts", "app/api/manager/retry/route.ts", "app/api/manager/remind/route.ts"];
for (const file of routes) for (const cookie of [undefined, "malformed", "valid-session"]) {
  test(`${file}: cookie=${cookie} is a zero-access 410`, async () => {
    const module = { exports: {} as any };
    const code = ts.transpileModule(readFileSync(resolve(__dirname, "../..", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    runInNewContext(code, { module, exports: module.exports,
      console: new Proxy({}, { get() { throw Error("Unexpected logging"); } }),
      require(name: string) { if (name !== "next/server") throw Error("Unexpected dependency " + name);
        return { NextResponse: { json: (body: any, options: any) => ({ body, status: options.status }) } }; },
    });
    const request = new Proxy({ cookie }, { get() { throw Error("Unexpected request/session/body access"); } });
    const response = await module.exports.POST(request);
    expect(response.status).toBe(410); expect(response.body).toEqual({ error: "This endpoint has been retired." });
  });
}
