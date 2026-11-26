import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { isRecord } from "../fixture-assertions";
export type FinancialBody = { ok?: boolean; received?: boolean; reconciled?: boolean; error?: string; data?: { url?: string } };
type MockReply = { status: number; body: FinancialBody };
type JsonReply = { status: number; json(): Promise<FinancialBody> };
type Diagnostics = (...values: unknown[]) => void;
type Mode = "mock" | "json";
type Environment = { NODE_ENV?: string; NEXT_PUBLIC_APP_URL?: string };
type Reply<Kind extends Mode> = Kind extends "json" ? JsonReply : MockReply;
type Libraries = {
 "lib/paymentStatus.ts": typeof import("../../lib/paymentStatus");
 "lib/rentDates.ts": typeof import("../../lib/rentDates");
 "lib/ledger.ts": typeof import("../../lib/ledger");
 "lib/session.ts": typeof import("../../lib/session");
 "lib/checkoutCollectibility.ts": typeof import("../../lib/checkoutCollectibility");
};
type Modules<Kind extends Mode> = Libraries & {
 "app/api/stripe/webhook/route.ts": { POST(request: { text(): Promise<string> }): Promise<Reply<Kind>> };
 "app/api/payments/create-session/route.ts": { POST(request: { headers: { get(name: string): string | null } }): Promise<Reply<Kind>> };
};
function financialBody(value: unknown): FinancialBody {
  assert.ok(isRecord(value), "Expected a structured financial response");
  for (const key of ["ok", "received", "reconciled"]) assert.ok(value[key] === undefined || typeof value[key] === "boolean", key);
  assert.ok(value.error === undefined || typeof value.error === "string");
  if (value.data !== undefined) { assert.ok(isRecord(value.data)); assert.ok(value.data.url === undefined || typeof value.data.url === "string"); }
  // All claimed fields above are checked; no missing values are substituted.
  return value;
}
function load<Kind extends Mode, File extends keyof Modules<Kind>>(mode: Kind, file: File, imports: Record<string, unknown>, suffix?: string, environment?: Environment, diagnostics?: Diagnostics): Modules<Kind>[File];
function load(mode: Mode, file: keyof Modules<Mode>, imports: Record<string, unknown>, suffix = "", environment: Environment = {}, diagnostics?: Diagnostics): unknown {
 const fixtureModule: { exports: unknown } = { exports: {} };
 const code = ts.transpileModule(readFileSync(resolve(__dirname, "../..", file), "utf8") + suffix, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
 }).outputText;
 runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Buffer, URL, Date, Set, Map,
  process: { env: { NODE_ENV: "production", STRIPE_SECRET_KEY: "isolated", STRIPE_WEBHOOK_SECRET: "isolated", ...environment } }, console: { log() {}, error(...values: unknown[]) { diagnostics?.(...values); } },
  require(name: string) { assert.ok(name in imports, "Unexpected import " + name); return imports[name]; },
 });
 const namespace = fixtureModule.exports; assert.ok(isRecord(namespace));
 if (file.startsWith("app/api/")) {
  const handler = namespace.POST; assert.ok(typeof handler === "function", "Expected the actual POST export");
  return { POST: async (request: unknown) => {
   const raw: unknown = await Reflect.apply(handler, namespace, [request]); assert.ok(isRecord(raw)); assert.ok(typeof raw.status === "number");
   if (mode === "mock") return { status: raw.status, body: financialBody(raw.body) };
   const json = raw.json; assert.ok(typeof json === "function");
   return { status: raw.status, json: async () => { const body: unknown = await Reflect.apply(json, raw, []); return financialBody(body); } };
  } };
 }
 // Library types in the closed path map are the actual source exports; runtime
 // evaluation and its dependency allowlist remain unchanged from the old harness.
 return namespace;
}
export function financialModule<Kind extends Mode>(mode: Kind, environment: Environment = {}, diagnostics?: Diagnostics) {
 return <File extends keyof Modules<Kind>>(file: File, imports: Record<string, unknown>, suffix = "") => load(mode, file, imports, suffix, environment, diagnostics);
}
