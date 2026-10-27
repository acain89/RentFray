import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import ts from "typescript";
import assert from "node:assert/strict";

export const stage2Secret = "isolated-stage2-representative-secret-at-least-32";
export function stage2Load<T>(file: string, mocks: Record<string, unknown> = {}, env: Record<string, string> = { NODE_ENV: "production", SESSION_SECRET: stage2Secret }): T {
  const fixtureModule = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: fixtureModule, exports: fixtureModule.exports, Buffer, Date, URL, URLSearchParams, Request, Response, Headers,
    process: { env }, console: { error() {} },
    require(name: string) {
      if (name in mocks) return mocks[name];
      if (name === "node:crypto") return crypto;
      if (name === "bcryptjs") return bcrypt;
      if (name === "@prisma/client") return { Prisma };
      assert.fail("Unmocked Stage 2 dependency: " + name);
    } });
  return fixtureModule.exports as T;
}
export function representativeRequest(path: string, body?: unknown, origin = "https://www.rentfray.com") {
  return new Request("https://www.rentfray.com" + path, { method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) }) });
}
