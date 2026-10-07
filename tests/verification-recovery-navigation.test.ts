import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as creatorSlugRules from "../lib/creatorSlugRules";

// Execute the actual proxy with NextResponse and referral reads mocked. No server, database,
// token issuance, email delivery, or external service is initialized.
function navigate(path: string, session?: string) {
  const module = { exports: {} as any };
  runInNewContext(ts.transpileModule(readFileSync("proxy.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, require(name: string) {
    if (name === "@/lib/prisma") return { prisma: { creator: { findUnique: async () => null } } };
    if (name === "@/lib/creatorSlugRules") return creatorSlugRules;
    assert.equal(name, "next/server");
    return { NextResponse: {
      next: () => ({ admitted: true }),
      redirect: (url: URL) => ({ admitted: false, destination: url.pathname, query: url.search }),
    } };
  } });
  const url = new URL(path, "https://isolated.invalid");
  return module.exports.proxy({ nextUrl: { pathname: url.pathname, clone: () => new URL(url) },
    cookies: { get: (name: string) => { assert.equal(name, "rf_session"); return session ? { value: session } : undefined; } } });
}
for (const path of ["/verify-email", "/verify-email?email=test@example.com", "/verify-email?status=invalid", "/verify-email?status=error", "/verify-email?email=test@example.com&sent=0&code=1234"]) {
  test(`anonymous recovery admits ${path}`, async () => assert.equal((await navigate(path)).admitted, true));
  test(`cookie-present recovery admits ${path} without redirect loop`, async () => assert.equal((await navigate(path, "existing-cookie")).admitted, true));
}
for (const path of ["/verify-email-admin", "/verify-secret", "/verify-email-other", "/manager/dashboard", "/tenant/dashboard", "/admin/properties", "/maintenance/dashboard"]) {
  test(`anonymous protected path ${path} preserves redirect`, async () => {
    const result = await navigate(path + "?recovery=1");
    assert.equal(result.admitted, false); assert.equal(result.destination, "/property-code"); assert.equal(result.query, "");
  });
}
for (const path of ["/api/auth/verify-email?token=invalid", "/api/auth/resend-verification", "/manager/login", "/property-code"]) {
  test(`existing page/API admission unchanged: ${path}`, async () => assert.equal((await navigate(path)).admitted, true));
}
test("signup and token recovery destinations survive anonymous proxy admission", async () => {
  const signup = readFileSync("app/api/setup/create-account/route.ts", "utf8");
  assert.ok(signup.includes('redirectTo: `/verify-email?email=${encodeURIComponent('));
  const verification = readFileSync("app/api/auth/verify-email/route.ts", "utf8");
  for (const status of ["invalid", "error"]) {
    assert.ok(verification.includes(`/verify-email?status=${status}`));
    assert.equal((await navigate(`/verify-email?status=${status}`)).admitted, true);
  }
  const page = readFileSync("app/verify-email/page.tsx", "utf8");
  assert.ok(page.includes('fetch("/api/auth/resend-verification"'));
  assert.ok(!page.includes("requireManagementSession"));
});
