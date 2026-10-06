import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, load } from "./admin-session-revalidation.test";
for (const method of ["GET", "POST"]) for (const condition of ["valid", "inactive", "deleted", "different", "old", "malformed", "expired", "wrong-role", "db-error"]) test(method + " backup " + condition, async () => {
  const f = fixture(); let token = f.token;
  if (condition === "inactive") f.state.admin.isActive = false; if (condition === "deleted") f.state.admin = null;
  if (condition === "different") f.state.admin.id = "b"; if (condition === "old") token = f.signed({ adminAccessId: undefined });
  if (condition === "malformed") token = "broken"; if (condition === "expired") token = f.signed({ exp: 1 });
  if (condition === "wrong-role") token = f.signed({ role: "MAINTENANCE", maintenanceUserId: "w", propertyId: "p" });
  if (condition === "db-error") f.state.fail = true;
  f.values.set("rf_admin_session", token); f.values.set("rf_session", "active-management");
  const route = load("app/api/admin/impersonate/exit/route.ts", { "next/headers": f.headers, "@/lib/session": f.session,
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }), redirect: (url: URL) => ({ path: url.pathname }) } } });
  const result = await route[method]({ url: "https://isolated.invalid/exit" });
  assert.equal(f.values.get("rf_session"), condition === "valid" ? token : "active-management"); assert.equal(f.values.get("rf_admin_session"), "");
  if (method === "POST") assert.equal(result.status, condition === "valid" ? 200 : 400);
  else assert.equal(result.path, condition === "valid" ? "/admin" : "/login/admin");
});
test("logout clears active and backup cookies", async () => {
  const f = fixture(); f.values.set("rf_admin_session", f.token); await f.session.clearSessionCookie();
  assert.equal(f.values.get("rf_session"), ""); assert.equal(f.values.get("rf_admin_session"), "");
  assert.ok(f.writes.every(w => w.options.maxAge === 0 && w.options.httpOnly));
});
