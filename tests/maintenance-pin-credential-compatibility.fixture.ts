import { isRecord } from "./fixture-assertions";
import * as gracePolicy from "../lib/gracePeriod";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import bcrypt from "bcryptjs";
import ts from "typescript";


type Reply = { status: number; body: Record<string, unknown>; headers: Record<string, unknown> };
type Modules = {
 "lib/pin.ts": typeof import("../lib/pin");
 "lib/propertySettings.ts": typeof import("../lib/propertySettings");
 "app/api/maintenance/session/route.ts": { POST(request: { json(): Promise<unknown> }): Promise<Reply> };
 "app/api/manager/maintenance/pin/route.ts": { POST(request: { json(): Promise<unknown> }): Promise<Reply> };
 "app/manager/properties/[id]/pin-reset/page.tsx": { saveMaintenancePin(form: { get(key: string): unknown }): Promise<void> };
};
export function loadSource<File extends keyof Modules>(file: File, imports: Record<string, unknown>, append?: string): Modules[File];
export function loadSource(file: keyof Modules, imports: Record<string, unknown>, append = ""): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8") + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Date, Buffer, console: { error() {} },
    require(name: string) { if (name === "@/lib/gracePeriod") return gracePolicy; if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; } });
  assert.ok(isRecord(fixtureModule.exports)); return fixtureModule.exports;
}

export const pinHelpers = loadSource("lib/pin.ts", { crypto });
export type Worker = { id: string; pinHash: string; propertyId?: string; isActive?: boolean };
export function loginFixture(workers: Worker[], denied = false, overrides: { compare?: (pin: string, hash: string) => Promise<boolean> } = {}) {
  const events: string[] = [];
  const sessions: Parameters<typeof import("../lib/session").createSessionToken>[0][] = [], writes: { where: { id: string }; data: { lastLoginAt: Date } }[] = [];
  const api = loadSource("app/api/maintenance/session/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body: JSON.parse(JSON.stringify(body)), status: options.status ?? 200, headers: options.headers ?? {} }) } },
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
      findMany: async ({ where, select }: { where: { propertyId: string; isActive: boolean }; select: { id: boolean; pinHash: boolean } }) => {
        assert.equal(events[0], "admission"); events.push("workers");
        assert.deepEqual(JSON.parse(JSON.stringify(where)), { propertyId: "p", isActive: true });
        assert.deepEqual(JSON.parse(JSON.stringify(select)), { id: true, pinHash: true });
        return workers.filter(w => (w.propertyId ?? "p") === where.propertyId && (w.isActive ?? true) === where.isActive);
      },
      update: async (query: { where: { id: string }; data: { lastLoginAt: Date } }) => { events.push("lastLoginAt"); writes.push(query); },
    } } },
    "@/lib/session": {
      createSessionToken: (payload: Parameters<typeof import("../lib/session").createSessionToken>[0]) => { events.push("session"); sessions.push(JSON.parse(JSON.stringify(payload))); return "isolated-token"; },
      setSessionCookie: async (token: string) => { assert.equal(token, "isolated-token"); events.push("cookie"); },
    },
  });
  return { events, sessions, writes, post: (pin = "1234") => api.POST({ json: async () => ({ propertyCode: "CODE", pin }) }) };
}

export const bcryptHash = bcrypt.hashSync("1234", 10);
export const scryptHash = pinHelpers.hashPin("5678");

export const malformed = ["$2b$10$short", "$2x$10$" + "a".repeat(53), "$2b$03$" + "a".repeat(53),
  "a".repeat(31) + ":" + "b".repeat(128), "a".repeat(32) + ":" + "b".repeat(127),
  "g".repeat(32) + ":" + "b".repeat(128), "plain:1234", "1234", "arbitrary:colon:string",
  " " + scryptHash, scryptHash + "\n"];
