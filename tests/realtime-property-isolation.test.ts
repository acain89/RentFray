import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import crypto from "node:crypto";

export function streamFixture(role: string | null = "OWNER", ssot?: { session: any; credential: () => string | undefined }) {
  let listener: any, heartbeat: any;
  let subscriptions = 0, timers = 0, validations = 0;
  let authority: any = role ? { role, propertyId: "a", managementUserId: "m" } : null;
  let validate: () => Promise<any> = async () => authority;
  const abort = new AbortController();
  const module = { exports: {} as any };
  const imports: any = {
    "next/server": { NextResponse: { json: (body: any, options: any) => ({ body, status: options.status }) } },
    "@/lib/permissions": { isManagementRole: (r: string) => ["OWNER", "MANAGER", "STAFF"].includes(r) },
    "@/lib/session": ssot?.session ?? { SESSION_COOKIE_NAME: "rf_session", getSession: async () => authority,
      validateSessionToken: async () => { validations++; return validate(); } },
    "@/lib/realtime": { subscribe: (fn: any) => { listener = fn; subscriptions++; return () => { subscriptions--; }; } },
  };
  let controller: any;
  const chunks: string[] = [];
  let closed = false, failEnqueue = false;
  class Stream {
    constructor(source: any) {
      controller = { desiredSize: 1, enqueue: (bytes: Uint8Array) => {
        if (failEnqueue) throw Error("delivery failed"); chunks.push(new TextDecoder().decode(bytes));
      }, close: () => { closed = true; } };
      source.start(controller); this.cancel = source.cancel;
    }
    cancel: any;
  }
  class ResponseStub { status = 200; constructor(public body: any, public options: any) {} }
  runInNewContext(ts.transpileModule(readFileSync("app/api/stream/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, TextEncoder, ReadableStream: Stream, Response: ResponseStub,
    setInterval: (fn: any) => { heartbeat = fn; timers++; return 1; }, clearInterval: () => { timers--; },
    require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  return {
    connect: () => module.exports.GET({ signal: abort.signal, cookies: { get: () => ({ value: ssot ? ssot.credential() : "captured-token" }) },
      nextUrl: new URL("https://isolated.invalid/api/stream?propertyId=b") }),
    emit: (data: any) => listener?.({ type: "ledger:update", data, timestamp: 1, version: 1 }),
    tick: () => heartbeat?.(), chunks, abort,
    setAuthority: (value: any) => { authority = value; }, setValidator: (fn: any) => { validate = fn; },
    failDelivery: () => { failEnqueue = true; }, backpressure: () => { controller.desiredSize = 0; },
    state: () => ({ subscriptions, timers, validations, closed }),
  };
}
export const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

for (const role of [null, "TENANT", "MAINTENANCE", "ADMIN"]) test(`stream rejects ${role}`, async () => {
  const f = streamFixture(role); const response = await f.connect();
  assert.equal(response.status, role ? 403 : 401); assert.equal(f.state().subscriptions, 0);
});
export function sessionFixture() {
  let token: string | undefined;
  let clock = Date.now();
  class Clock extends Date { static now() { return clock; } }
  const user: any = { id: "m", propertyId: "a", role: "OWNER", isActive: true, passwordHash: "synthetic-credential" };
  let fail = false;
  const module = { exports: {} as any };
  const imports: any = { crypto, "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    "@/lib/prisma": { prisma: { managementUser: { findUnique: async () => { if (fail) throw Error("DB unavailable"); return user; } } } } };
  runInNewContext(ts.transpileModule(readFileSync("lib/session.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, Buffer, Date: Clock,
    process: { env: { SESSION_SECRET: "isolated-realtime-test", NODE_ENV: "test" } },
    require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  token = module.exports.createSessionToken({ role: "OWNER", propertyId: "a", managementUserId: "m",
    managementCredentialBinding: module.exports.createManagementCredentialBinding(user.id, user.passwordHash) });
  return { session: module.exports, credential: () => token, user,
    setToken: (value: string | undefined) => { token = value; }, expire: () => { clock += 8 * 86400000; },
    fail: () => { fail = true; } };
}
for (const invalid of ["absent", "malformed", "signature-invalid", "expired", "stale", "database failure"]) test(`actual session SSOT rejects ${invalid}`, async () => {
  const auth = sessionFixture();
  if (invalid === "absent") auth.setToken(undefined);
  if (invalid === "malformed") auth.setToken("broken");
  if (invalid === "signature-invalid") auth.setToken(auth.credential() + "x");
  if (invalid === "expired") auth.expire();
  if (invalid === "stale") auth.user.isActive = false;
  if (invalid === "database failure") auth.fail();
  const f = streamFixture("OWNER", auth); assert.equal((await f.connect()).status, 401);
  assert.equal(f.state().subscriptions, 0);
});
for (const role of ["OWNER", "MANAGER", "STAFF"]) test(`${role} receives only authenticated property`, async () => {
  const f = streamFixture(role); const response = await f.connect(); assert.equal(response.status, 200);
  for (const data of [undefined, {}, { propertyId: 4 }, { propertyId: "" }, { propertyId: "b" }]) f.emit(data);
  await flush(); assert.equal(f.chunks.length, 0);
  f.emit({ propertyId: "a", unitId: "u" }); await flush();
  assert.equal(f.chunks.length, 1); assert.match(f.chunks[0], /"propertyId":"a"/);
  response.body.cancel(); assert.equal(f.state().subscriptions, 0);
});

for (const action of ["CREATE", "PIN_TOGGLE"]) test(`notes ${action} emits trusted property despite client scope`, async () => {
  const events: any[] = []; const module = { exports: {} as any };
  const imports: any = {
    "@/lib/session": { getSession: async () => ({ role: "OWNER", propertyId: "a", managementUserId: "m" }) },
    "@/lib/realtime": { emitEvent: (type: string, data: any) => events.push({ type, data }) },
    "next/server": { NextResponse: { json: (body: any) => ({ status: 200, body }) } },
    "@/lib/prisma": { prisma: {
      unit: { findFirst: async ({ where }: any) => { assert.equal(where.propertyId, "a"); return { id: "u" }; } },
      unitNote: {
        findFirst: async ({ where }: any) => { assert.equal(where.propertyId, "a"); return { id: "n", unitId: "u", isPinned: false }; },
        create: async ({ data }: any) => { assert.equal(data.propertyId, "a"); return { id: "n", ...data }; },
        update: async ({ where }: any) => { assert.equal(where.propertyId, "a"); return { id: "n", unitId: "u" }; },
      },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync("app/api/notes/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, console,
    require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  const response = await module.exports.POST({ json: async () => ({ action, unitId: "u", noteId: "n", content: "Note", propertyId: "b" }) });
  assert.equal(response.status, 200); assert.equal(events.length, 1);
  assert.deepEqual(events[0].data.propertyId, "a"); assert.equal(events[0].data.unitId, "u");
});
