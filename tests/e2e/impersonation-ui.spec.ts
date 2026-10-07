import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";

// Isolated source regressions: no browser, network, real Prisma, or application server.
const root = resolve(__dirname, "../..");
const forbidden = () => { throw new Error("Unexpected database or service access"); };
const blockedPrisma = new Proxy({}, { get: forbidden });

function loadSource(source: string, imports: Record<string, unknown>, extras = {}) {
  const module = { exports: {} as Record<string, any> };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(output, {
    module, exports: module.exports, Buffer, URL, Date,
    process: { env: { NODE_ENV: "production", SESSION_SECRET: "isolated-test-secret" } },
    console,
    require: (name: string) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    ...extras,
  });
  return module.exports;
}

function fixture() {
  let clock = Date.now();
  class Clock extends Date { static now() { return clock; } }
  const values = new Map<string, string>();
  const writes: { name: string; value: string; options: any }[] = [];
  const cookieStore = {
    get: (name: string) => values.has(name) ? { value: values.get(name) } : undefined,
    set: (name: string, value: string, options: any) => {
      writes.push({ name, value, options }); values.set(name, value);
    },
  };
  const headers = { cookies: async () => cookieStore };
  const session = loadSource(readFileSync(resolve(root, "lib/session.ts"), "utf8"), {
    crypto, "next/headers": headers, "@/lib/prisma": { prisma: { adminAccess: { findUnique: async ({ where }: any) => where.id === "admin" ? { id: "admin", isActive: true } : null }, managementUser: { findUnique: async () => ({ id: "manager-a", role: "MANAGER", propertyId: "property-a", isActive: true, passwordHash: "synthetic-credential" }) } } },
  }, { Date: Clock });
  const admin = session.createSessionToken({ role: "ADMIN", adminAccessId: "admin" });
  const wrongRole = session.createSessionToken({
    role: "MANAGER", propertyId: "property-a", managementUserId: "manager-a",
    managementCredentialBinding: session.createManagementCredentialBinding("manager-a", "synthetic-credential"),
  });
  const responses = { NextResponse: {
    json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }),
    redirect: (url: URL) => ({ destination: url.pathname }),
  } };
  return { session, admin, wrongRole, values, writes, headers, responses,
    expire: () => { clock += 8 * 24 * 60 * 60 * 1000; } };
}

const backupCases = ["valid", "absent", "malformed", "signature-invalid", "expired", "wrong-role", "invalid-shape"];
function setBackup(f: ReturnType<typeof fixture>, kind: string) {
  if (kind === "absent") return;
  let token = f.admin;
  if (kind === "malformed") token = "malformed";
  if (kind === "signature-invalid") token = `${f.admin.split(".")[0]}.invalid-signature`;
  if (kind === "wrong-role") token = f.wrongRole;
  if (kind === "expired") f.expire();
  if (kind === "invalid-shape") {
    const body = Buffer.from(JSON.stringify({ role: "ADMIN" })).toString("base64url");
    token = `${body}.${crypto.createHmac("sha256", "isolated-test-secret").update(body).digest("base64url")}`;
  }
  f.values.set("rf_admin_session", token);
}

for (const method of ["GET", "POST"]) {
  for (const kind of backupCases) {
    for (const active of [false, true]) {
      test(`exit ${method}: ${kind} backup, active session ${active}`, async () => {
        const f = fixture();
        setBackup(f, kind);
        if (active) f.values.set("rf_session", "existing-active-session");
        const route = loadSource(readFileSync(resolve(root, "app/api/admin/impersonate/exit/route.ts"), "utf8"), {
          "next/headers": f.headers, "next/server": f.responses, "@/lib/session": f.session,
        });
        const response = await route[method]({ url: "https://isolated.invalid/exit" });
        const valid = kind === "valid";
        expect(f.values.get("rf_session")).toBe(valid ? f.admin : active ? "existing-active-session" : undefined);
        const backupWrites = f.writes.filter(w => w.name === "rf_admin_session");
        expect(backupWrites.length).toBe(kind === "absent" ? 0 : 1);
        if (backupWrites.length) {
          expect(backupWrites[0].value).toBe("");
          expect(backupWrites[0].options).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
        }
        if (valid) expect(f.writes.find(w => w.name === "rf_session")?.options.httpOnly).toBe(true);
        else expect(f.writes.some(w => w.name === "rf_session")).toBe(false);
        if (method === "GET") expect(response.destination).toBe(valid ? "/admin" : "/login/admin");
        else {
          expect(response.status).toBe(valid ? 200 : 400);
          expect(response.body).toEqual(valid ? { ok: true, redirectTo: "/admin" } : { error: "No admin session to restore." });
        }
      });
    }
  }
}

for (const role of ["OWNER", "MANAGER", "STAFF"]) {
  for (const kind of backupCases) {
    test(`dashboard: ${role}, ${kind} backup`, async () => {
      const f = fixture();
      setBackup(f, kind);
      const property = {
        id: "property-a", name: "Test property", status: "READY", isActive: true,
        unitCount: 0, units: [], managementUsers: [], settings: {}, paymentStatus: null,
        stripeAccountId: null, rentFrayStartDate: null,
      };
      const prisma = {
        property: { findUnique: async () => property, update: forbidden },
        unit: { findMany: async () => [] }, propertyTier: { findMany: async () => [] },
        payment: blockedPrisma, ledgerEntry: blockedPrisma, paymentConnectionStatus: blockedPrisma,
      };
      const route = loadSource(readFileSync(resolve(root, "app/api/manager/dashboard/route.ts"), "utf8"), {
        "next/headers": f.headers, "next/server": f.responses, "@/lib/prisma": { prisma },
        "@/lib/session": { ...f.session,
          getSession: async () => ({ role, propertyId: "property-a", managementUserId: "manager-a" }),
          refreshSessionCookie: async () => {},
        },
        "@/lib/stripe": { getStripeClient: forbidden },
        "@/lib/propertyStatus": { shouldAutoSetPropertyReady: () => false },
        "@/lib/rentDates": {
          getBusinessDate: () => new Date(), resolveEffectiveBillingSettings: () => ({}),
          getRentDateSummary: () => ({ billingCycle: "2026-10" }),
        },
        "@/lib/billingConfig": { formatCentsToDollars: forbidden },
        "@/lib/unitFinancialState": { getUnitFinancialState: forbidden },
      });
      const response = await route.GET();
      expect(response.status).toBe(200);
      expect(response.body.session).toEqual({ role, isImpersonating: kind === "valid" });
      expect(JSON.stringify(response.body)).not.toContain(f.admin);
      expect(JSON.stringify(response.body)).not.toContain("rf_admin_session");
      expect(f.writes).toEqual([]);
    });
  }
}

for (const isImpersonating of [true, false]) {
  test(`existing exit UI renders from server boolean ${isImpersonating}`, () => {
    const source = readFileSync(resolve(root, "app/manager/dashboard/ManagerDashboardClient.tsx"), "utf8");
    expect(source).not.toContain('document.cookie.includes("rf_admin_session=")');
    const ast = ts.createSourceFile("client.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const matches: ts.ConditionalExpression[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isConditionalExpression(node) && node.condition.getText(ast) === "data?.session.isImpersonating") matches.push(node);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(matches).toHaveLength(1);
    // Render the actual banner JSX from source, without mounting the dashboard or running effects.
    const component = loadSource(`export const render = (data: any) => (${matches[0].getText(ast)});`, {
      "react/jsx-runtime": jsxRuntime,
    });
    const markup = renderToStaticMarkup(component.render({ session: { isImpersonating } }));
    if (isImpersonating) expect(markup).toContain("Exit Impersonation");
    else expect(markup).not.toContain("Exit Impersonation");
  });
}
