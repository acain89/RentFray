import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as calendar from "../lib/representativeCalendar";
import type * as ReferralModule from "../lib/representativeReferrals";

const root = resolve(__dirname, "..");
export const signingSecret = "isolated-representative-secret-32-characters";

// No application imports, environment-file loading, email, or provider clients.
export function loadRepresentativeModule<T>(file: string, mocks: Record<string, unknown>,
  env: Record<string, string> = { SESSION_SECRET: signingSecret, NODE_ENV: "production" }): T {
  const fixtureModule = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module: fixtureModule, exports: fixtureModule.exports, Buffer, Date, URL, process: { env }, console: { error() {} },
    require(name: string) {
      if (name === "node:crypto") return { createHmac, timingSafeEqual };
      if (name === "./representativeCalendar") return calendar;
      assert.ok(name in mocks, "Unexpected dependency: " + name); return mocks[name];
    } });
  return fixtureModule.exports as T;
}
export const referrals = loadRepresentativeModule<typeof ReferralModule>("lib/representativeReferrals.ts", {});
