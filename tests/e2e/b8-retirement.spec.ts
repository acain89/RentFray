import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const routes = [
  ["app/api/manager/tenants/reset-pin/route.ts", "POST"],
  ["app/api/tenant/payment-receipts/route.ts", "GET"],
  ["app/api/tenant/maintenance/route.ts", "GET"],
  ["app/api/tenant/maintenance/route.ts", "POST"],
  ["app/api/admin/property/set-status/route.ts", "POST"],
  ["app/api/manager/property/readiness/route.ts", "GET"],
];
for (const [file, method] of routes) {
  test(`${file} ${method} is a non-mutating 410 tombstone`, async () => {
    const module = { exports: {} as Record<string, any> };
    const source = readFileSync(resolve(__dirname, "../..", file), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    } }).outputText;
    runInNewContext(code, { module, exports: module.exports,
      require(name: string) {
        // Any Prisma/session/service import is a failure, even before a handler runs.
        if (name !== "next/server") throw new Error("Unexpected access: " + name);
        return { NextResponse: { json: (body: unknown, options: any) => ({ body, status: options.status }) } };
      },
    });
    const request = new Proxy({}, { get() { throw new Error("Retired route read request data"); } });
    const response = await module.exports[method](request);
    expect(response.status).toBe(410);
    expect(response.body).toEqual({ error: "This endpoint has been retired." });
  });
}
