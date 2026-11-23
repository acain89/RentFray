import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as creatorSlugRules from "../lib/creatorSlugRules";

type Result = { admitted: boolean; destination?: string; query?: string };
type ProxyModule = { proxy(request: unknown): Promise<Result> };

// Execute the real proxy with fail-closed database and framework doubles.
// No database client, session issuance, or provider is initialized.
async function navigate(path: string, session = false): Promise<Result> {
  let databaseReads = 0;
  const fixture: { exports: unknown } = { exports: {} };
  const source = ts.transpileModule(readFileSync("proxy.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    module: fixture, exports: fixture.exports,
    require(name: string): unknown {
      if (name === "@/lib/creatorSlugRules") return creatorSlugRules;
      if (name === "@/lib/prisma") return { prisma: { creator: { findUnique() {
        databaseReads++;
        return null;
      } } } };
      assert.equal(name, "next/server");
      return { NextResponse: {
        next: (): Result => ({ admitted: true }),
        redirect: (url: URL): Result => ({ admitted: false, destination: url.pathname, query: url.search }),
      } };
    },
  });
  const url = new URL(path, "https://isolated.invalid");
  const result = await (fixture.exports as ProxyModule).proxy({
    nextUrl: { pathname: url.pathname, clone: () => new URL(url) },
    cookies: { get: (name: string) => {
      assert.equal(name, "rf_session");
      return session ? { value: "synthetic-cookie" } : undefined;
    } },
  });
  if (["/terms", "/terms/", "/privacy", "/privacy/"].includes(url.pathname)) {
    assert.equal(databaseReads, 0, "Legal pages must not query the database");
  }
  return result;
}

for (const path of ["/terms", "/privacy", "/terms/", "/privacy/", "/terms?source=checkout", "/privacy?source=setup"]) {
  test(`anonymous legal page is public: ${path}`, async () => {
    assert.equal((await navigate(path)).admitted, true);
  });
  test(`cookie-present legal page stays public: ${path}`, async () => {
    assert.equal((await navigate(path, true)).admitted, true);
  });
}

for (const path of ["/manager/dashboard", "/tenant/dashboard", "/admin/properties", "/maintenance/dashboard", "/terms-admin", "/privacy-settings"]) {
  test(`anonymous private/lookalike route retains redirect: ${path}`, async () => {
    const result = await navigate(`${path}?source=legal`);
    assert.equal(result.admitted, false);
    assert.equal(result.destination, "/property-code");
    assert.equal(result.query, "");
  });
}

for (const path of ["/api/manual-payments", "/api/manager/dashboard", "/api/tenant/dashboard"]) {
  test(`API requests retain handler-level authorization boundary: ${path}`, async () => {
    // The existing proxy forwards APIs; their handlers remain responsible for auth.
    assert.equal((await navigate(path)).admitted, true);
  });
}

test("legal entries occur once and documents require no private data", () => {
  const source = readFileSync("proxy.ts", "utf8");
  const pages = source.match(/const PUBLIC_PAGE_ROUTES = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(pages);
  for (const route of ["/terms", "/privacy"]) {
    assert.equal(pages.split(`"${route}"`).length - 1, 1);
  }
  // Legal directories contain static public documents, with no data loading.
  for (const file of ["app/terms/page.tsx", "app/privacy/page.tsx"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /getSession|requireSession|prisma\.|cookies\(|fetch\(/);
  }
});
