import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import bcrypt from "bcryptjs";
import ts from "typescript";

export function loadSource(file: string, imports: Record<string, any>, append = "") {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8") + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, Date, Buffer, console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; } });
  return module.exports;
}

export const pinHelpers = loadSource("lib/pin.ts", { crypto });
type Worker = { id: string; pinHash: string; propertyId?: string; isActive?: boolean };
export function loginFixture(workers: Worker[], denied = false, overrides: any = {}) {
  const events: string[] = [];
  const sessions: any[] = [], writes: any[] = [];
  const api = loadSource("app/api/maintenance/session/route.ts", {
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body: JSON.parse(JSON.stringify(body)), status: options.status ?? 200, headers: options.headers ?? {} }) } },
    "@/lib/authThrottle": { admitMaintenanceLogin: async (code: string) => {
      assert.equal(code, "CODE"); events.push("admission");
      return denied ? { admitted: false, retryAfter: 30 } : { admitted: true, property: { id: "p", isActive: true, status: "LIVE" } };
    } },
    bcryptjs: { compare: async (pin: string, hash: string) => {
      assert.equal(events[0], "admission"); events.push("bcrypt");
      return overrides.compare ? overrides.compare(pin, hash) : bcrypt.compare(pin, hash);
    } },
    "@/lib/pin": { verifyPin: (pin: string, hash: string) => {
      assert.equal(events[0], "admission"); events.push("scrypt");
      return pinHelpers.verifyPin(pin, hash);
    } },
    "@/lib/prisma": { prisma: { maintenanceUser: {
      findMany: async ({ where, select }: any) => {
        assert.equal(events[0], "admission"); events.push("workers");
        assert.deepEqual(JSON.parse(JSON.stringify(where)), { propertyId: "p", isActive: true });
        assert.deepEqual(JSON.parse(JSON.stringify(select)), { id: true, pinHash: true });
        return workers.filter(w => (w.propertyId ?? "p") === where.propertyId && (w.isActive ?? true) === where.isActive);
      },
      update: async (query: any) => { events.push("lastLoginAt"); writes.push(query); },
    } } },
    "@/lib/session": {
      createSessionToken: (payload: any) => { events.push("session"); sessions.push(JSON.parse(JSON.stringify(payload))); return "isolated-token"; },
      setSessionCookie: async (token: string) => { assert.equal(token, "isolated-token"); events.push("cookie"); },
    },
  });
  return { events, sessions, writes, post: (pin = "1234") => api.POST({ json: async () => ({ propertyCode: "CODE", pin }) }) };
}

const bcryptHash = bcrypt.hashSync("1234", 10);
const scryptHash = pinHelpers.hashPin("5678");
for (const [format, hash, correct] of [["bcrypt", bcryptHash, "1234"], ["scrypt", scryptHash, "5678"]]) {
  test(format + " correct PIN retains identity, cookie, and lastLoginAt only", async () => {
    const f = loginFixture([{ id: "worker", pinHash: hash }]);
    const result = await f.post(correct);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, role: "MAINTENANCE", propertyId: "p", maintenanceUserId: "worker" });
    assert.deepEqual(f.sessions, [{ role: "MAINTENANCE", propertyId: "p", maintenanceUserId: "worker" }]);
    assert.deepEqual(f.events, ["admission", "workers", format, "session", "cookie", "lastLoginAt"]);
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0].where.id, "worker");
    assert.deepEqual(Object.keys(f.writes[0].data), ["lastLoginAt"]);
    assert.ok(f.writes[0].data.lastLoginAt instanceof Date);
  });
  test(format + " wrong PIN fails without session or credential rewrite", async () => {
    const f = loginFixture([{ id: "worker", pinHash: hash }]);
    assert.equal((await f.post("0000")).status, 401); assert.equal(f.sessions.length, 0); assert.equal(f.writes.length, 0);
  });
}

const malformed = ["$2b$10$short", "$2x$10$" + "a".repeat(53), "$2b$03$" + "a".repeat(53),
  "a".repeat(31) + ":" + "b".repeat(128), "a".repeat(32) + ":" + "b".repeat(127),
  "g".repeat(32) + ":" + "b".repeat(128), "plain:1234", "1234", "arbitrary:colon:string",
  " " + scryptHash, scryptHash + "\n"];
for (const hash of malformed) test("unknown/malformed credential rejected: " + hash.slice(0, 20), async () => {
  const f = loginFixture([{ id: "bad", pinHash: hash }]);
  assert.equal((await f.post()).status, 401); assert.equal(f.sessions.length, 0); assert.equal(f.writes.length, 0);
  assert.deepEqual(f.events, ["admission", "workers"]);
});
test("malformed record does not block a later valid worker", async () => {
  const f = loginFixture([{ id: "bad", pinHash: "plain:1234" }, { id: "good", pinHash: bcryptHash }]);
  assert.equal((await f.post()).body.maintenanceUserId, "good");
});
test("bcrypt verifier failure does not block a later valid historical worker", async () => {
  const f = loginFixture([{ id: "bad", pinHash: bcryptHash }, { id: "good", pinHash: scryptHash }], false,
    { compare: async () => { throw Error("Malformed bcrypt record"); } });
  assert.equal((await f.post("5678")).body.maintenanceUserId, "good");
});
for (const [pin, id] of [["1234", "bcrypt-worker"], ["5678", "scrypt-worker"]]) test("mixed worker identities " + id, async () => {
  const f = loginFixture([{ id: "unknown", pinHash: "bad" }, { id: "bcrypt-worker", pinHash: bcryptHash }, { id: "scrypt-worker", pinHash: scryptHash }]);
  assert.equal((await f.post(pin)).body.maintenanceUserId, id);
});
for (const worker of [{ id: "inactive", pinHash: bcryptHash, isActive: false }, { id: "foreign", pinHash: scryptHash, propertyId: "other" }]) {
  test(worker.id + " excluded by scoped active query", async () => {
    const f = loginFixture([worker]); assert.equal((await f.post(worker.id === "foreign" ? "5678" : "1234")).status, 401);
    assert.deepEqual(f.events, ["admission", "workers"]);
  });
}
test("throttle denial prevents both algorithms and all resource/session work", async () => {
  const f = loginFixture([{ id: "bcrypt", pinHash: bcryptHash }, { id: "scrypt", pinHash: scryptHash }], true);
  const result = await f.post(); assert.equal(result.status, 429); assert.equal(result.headers["Retry-After"], "30");
  assert.deepEqual(f.events, ["admission"]); assert.equal(f.sessions.length, 0); assert.equal(f.writes.length, 0);
});
