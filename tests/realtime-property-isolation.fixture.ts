import { requiredValue } from "./fixture-assertions";
import type { RealtimePayload } from "../lib/realtime";
export type StreamAuthority = { role: string; propertyId?: string; managementUserId?: string } | null;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import crypto from "node:crypto";


export function streamFixture(role: string | null = "OWNER", ssot?: { session: Pick<typeof import("../lib/session"), "getSession" | "validateSessionToken"> & { SESSION_COOKIE_NAME: string }; credential: () => string | undefined }) {
  let listener: ((event: RealtimePayload) => void) | undefined, heartbeat: (() => void) | undefined;
  let subscriptions = 0, timers = 0, validations = 0;
  let authority: StreamAuthority = role ? { role, propertyId: "a", managementUserId: "m" } : null;
  let validate: () => Promise<StreamAuthority> = async () => authority;
  const abort = new AbortController();
  const fixtureModule: { exports: Partial<{ GET(request: { signal: AbortSignal; cookies: { get(): { value: string | undefined } }; nextUrl: URL }): Promise<{ status: number; body: unknown }> }> } = { exports: {} };
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit }) => ({ body, status: options.status }) } },
    "@/lib/permissions": { isManagementRole: (r: string) => ["OWNER", "MANAGER", "STAFF"].includes(r) },
    "@/lib/session": ssot?.session ?? { SESSION_COOKIE_NAME: "rf_session", getSession: async () => authority,
      validateSessionToken: async () => { validations++; return validate(); } },
    "@/lib/realtime": { subscribe: (fn: (event: RealtimePayload) => void) => { listener = fn; subscriptions++; return () => { subscriptions--; }; } },
  };
  type Controller = { desiredSize: number; enqueue(bytes: Uint8Array): void; close(): void };
  let controller: Controller | undefined;
  const chunks: string[] = [];
  let closed = false, failEnqueue = false;
  class Stream {
    constructor(source: { start(controller: Controller): void; cancel(): void }) {
      controller = { desiredSize: 1, enqueue: (bytes: Uint8Array) => {
        if (failEnqueue) throw Error("delivery failed"); chunks.push(new TextDecoder().decode(bytes));
      }, close: () => { closed = true; } };
      source.start(controller); this.cancel = source.cancel;
    }
    cancel: () => void;
  }
  class ResponseStub { status = 200; constructor(public body: unknown, public options: ResponseInit) {} }
  runInNewContext(ts.transpileModule(readFileSync("app/api/stream/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: fixtureModule, exports: fixtureModule.exports, TextEncoder, ReadableStream: Stream, Response: ResponseStub,
    setInterval: (fn: () => void) => { heartbeat = fn; timers++; return 1; }, clearInterval: () => { timers--; },
    require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  return {
    connect: () => requiredValue(fixtureModule.exports.GET)({ signal: abort.signal, cookies: { get: () => ({ value: ssot ? ssot.credential() : "captured-token" }) },
      nextUrl: new URL("https://isolated.invalid/api/stream?propertyId=b") }),
    emit: (data: unknown) => listener?.({ type: "ledger:update", data, timestamp: 1, version: 1 }),
    tick: () => heartbeat?.(), chunks, abort,
    setAuthority: (value: StreamAuthority) => { authority = value; }, setValidator: (fn: () => Promise<StreamAuthority>) => { validate = fn; },
    failDelivery: () => { failEnqueue = true; }, backpressure: () => { requiredValue(controller).desiredSize = 0; },
    state: () => ({ subscriptions, timers, validations, closed }),
  };
}
export const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
export function sessionFixture() {
  let token: string | undefined;
  let clock = Date.now();
  class Clock extends Date { static now() { return clock; } }
  const user: { id: string; propertyId?: string; role: string; isActive: boolean; passwordHash: string } = { id: "m", propertyId: "a", role: "OWNER", isActive: true, passwordHash: "synthetic-credential" };
  let fail = false;
  const fixtureModule: { exports: Partial<typeof import("../lib/session")> } = { exports: {} };
  const imports: Record<string, unknown> = { crypto, "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    "@/lib/prisma": { prisma: { managementUser: { findUnique: async () => { if (fail) throw Error("DB unavailable"); return user; } } } } };
  runInNewContext(ts.transpileModule(readFileSync("lib/session.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { module: fixtureModule, exports: fixtureModule.exports, Buffer, Date: Clock,
    process: { env: { SESSION_SECRET: "synthetic-isolated-realtime-test-session-secret-key", NODE_ENV: "test" } },
    require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  const session = { ...fixtureModule.exports, SESSION_COOKIE_NAME: requiredValue(fixtureModule.exports.SESSION_COOKIE_NAME), getSession: requiredValue(fixtureModule.exports.getSession), validateSessionToken: requiredValue(fixtureModule.exports.validateSessionToken), createSessionToken: requiredValue(fixtureModule.exports.createSessionToken), createManagementCredentialBinding: requiredValue(fixtureModule.exports.createManagementCredentialBinding) };
  token = session.createSessionToken({ role: "OWNER", propertyId: "a", managementUserId: "m",
    managementCredentialBinding: session.createManagementCredentialBinding(user.id, user.passwordHash) });
  return { session, credential: () => token, user,
    setToken: (value: string | undefined) => { token = value; }, expire: () => { clock += 8 * 86400000; },
    fail: () => { fail = true; } };
}
