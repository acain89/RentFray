import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Session = typeof import("../lib/session");
const key = "synthetic-session-secret-for-isolated-tests";
const otherKey = "synthetic-other-session-secret-for-isolated-tests";
const fallback = "rentfray-dev-session-secret-change-me";
const root = resolve(__dirname, "..");
function sourceModule<T>(source: string, imports: Record<string, unknown>, env: Record<string, unknown>): T {
  const holder = { exports: {} };
  runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, { module: holder, exports: holder.exports, Buffer, Date,
    process: { env }, require(name: string) {
      assert.ok(name in imports, "Unexpected isolated dependency: " + name); return imports[name];
    } });
  return holder.exports as T;
}
function fixture(...args: [secret?: unknown, nodeEnv?: unknown, source?: string]) {
  const secret = args.length > 0 ? args[0] : key;
  const nodeEnv = args.length > 1 ? args[1] : "production";
  const source = args[2];
  const state = {
    authorityFailure: false,
    admin: { id: "admin", isActive: true },
    management: { id: "manager", propertyId: "property", role: "OWNER", isActive: true, passwordHash: "synthetic-hash" },
    worker: { id: "worker", propertyId: "property", isActive: true },
    assignment: { propertyId: "property", unitId: "unit", isCurrent: true, moveOutDate: null as Date | null,
      unit: { id: "unit", propertyId: "property" } },
  };
  const cookies = new Map<string, string>(); const writes: Array<{ name: string; options: Record<string, unknown> }> = [];
  const readAuthority = <T>(value: T): T => {
    if (state.authorityFailure) throw new Error("synthetic database authority failure");
    return value;
  };
  const db = {
    adminAccess: { findUnique: async () => readAuthority(state.admin) },
    managementUser: { findUnique: async () => readAuthority(state.management) },
    maintenanceUser: { findUnique: async () => readAuthority(state.worker) },
    tenantAssignment: { findUnique: async () => readAuthority(state.assignment) },
  };
  const session = sourceModule<Session>(source ?? readFileSync(resolve(root, "lib/session.ts"), "utf8"), {
    crypto, "@/lib/prisma": { prisma: db }, "next/headers": { cookies: async () => ({
      get: (name: string) => cookies.has(name) ? { value: cookies.get(name) } : undefined,
      set: (name: string, value: string, options: Record<string, unknown>) => { cookies.set(name, value); writes.push({ name, options }); },
    }) },
  }, { SESSION_SECRET: secret, NODE_ENV: nodeEnv });
  return { session, state, cookies, writes };
}
const admin = { role: "ADMIN" as const, adminAccessId: "admin" };
const tenant = { role: "TENANT" as const, propertyId: "property", unitId: "unit", tenantAssignmentId: "assignment" };
const worker = { role: "MAINTENANCE" as const, propertyId: "property", maintenanceUserId: "worker" };
for (const [label, secret] of [["missing", undefined], ["empty", ""], ["whitespace", " ".repeat(40)],
  ["short", "short-synthetic"], ["public fallback", fallback], ["non-string", 123], ["30 UTF-8 bytes", "\u00e9".repeat(15)]] as const) {
  test("reject production configuration: " + label, () => {
    const f = fixture(secret);
    assert.throws(() => f.session.createSessionToken(admin), /configuration/i);
    assert.throws(() => f.session.createManagementCredentialBinding("manager", "synthetic-hash"), /configuration/i);
    assert.throws(() => f.session.validateSessionConfiguration(), /configuration/i);
  });
}
for (const env of ["development", "test", "preview", undefined]) test("no fallback in environment " + String(env), () => {
  assert.throws(() => fixture(undefined, env).session.createSessionToken(admin), /configuration/i);
});
for (const secret of [key, "\u00e9".repeat(16), " " + key + " "]) test("preserve exact suitable key bytes: " + Buffer.byteLength(secret), () => {
  const f = fixture(secret); f.session.validateSessionConfiguration(); const token = f.session.createSessionToken(admin);
  const payload = token.split(".")[0];
  assert.equal(token.split(".")[1], crypto.createHmac("sha256", secret).update(payload).digest("base64url"));
  assert.ok(f.session.verifySessionToken(token));
});
test("configuration errors never disclose key or credential material", () => {
  const secret = "private-short-marker";
  assert.throws(() => fixture(secret).session.createSessionToken(admin), (error: unknown) => {
    assert.ok(error instanceof Error || (typeof error === "object" && error !== null && "message" in error));
    const message = String((error as { message: unknown }).message);
    assert.ok(!message.includes(secret) && !message.includes("synthetic-hash")); return true;
  });
});
test("module imports remain lazy under invalid configuration", () => {
  assert.doesNotThrow(() => fixture(undefined));
  assert.doesNotThrow(() => sourceModule(readFileSync(resolve(root, "instrumentation.ts"), "utf8"), {}, {}));
});
test("unchanged strong key accepts committed cookies and credential bindings", async () => {
  const old = fixture(key, "production", execFileSync("git", ["show", "HEAD:lib/session.ts"], { cwd: root, encoding: "utf8" }));
  const current = fixture();
  assert.equal(current.session.createManagementCredentialBinding("manager", "synthetic-hash"), old.session.createManagementCredentialBinding("manager", "synthetic-hash"));
  const claims = { role: "OWNER" as const, propertyId: "property", managementUserId: "manager",
    managementCredentialBinding: old.session.createManagementCredentialBinding("manager", "synthetic-hash") };
  assert.equal((await current.session.validateSessionToken(old.session.createSessionToken(claims)))?.role, "OWNER");
  assert.equal((await current.session.validateSessionToken(old.session.createSessionToken(admin)))?.role, "ADMIN");
});
test("same-key instances agree; key change invalidates signature and binding", () => {
  const a = fixture(), b = fixture(), c = fixture(otherKey); const token = a.session.createSessionToken(admin);
  assert.ok(b.session.verifySessionToken(token)); assert.equal(c.session.verifySessionToken(token), null);
  assert.notEqual(a.session.createManagementCredentialBinding("manager", "synthetic-hash"), c.session.createManagementCredentialBinding("manager", "synthetic-hash"));
});
test("bad, expired and public-fallback signatures fail closed", async () => {
  const f = fixture(); const token = f.session.createSessionToken(admin);
  assert.equal(f.session.verifySessionToken(token + "broken"), null);
  const expired = Buffer.from(JSON.stringify({ ...admin, iat: 1, exp: 2 })).toString("base64url");
  assert.equal(f.session.verifySessionToken(expired + "." + crypto.createHmac("sha256", key).update(expired).digest("base64url")), null);
  assert.equal(await f.session.validateSessionToken(token.split(".")[0] + "." + crypto.createHmac("sha256", fallback).update(token.split(".")[0]).digest("base64url")), null);
  assert.equal(await fixture(undefined).session.validateSessionToken(token), null);
});
for (const role of ["OWNER", "MANAGER", "STAFF"] as const) test(role + " current credential/role/property authority remains required", async () => {
  const f = fixture(); f.state.management.role = role;
  const claims = { role, propertyId: "property", managementUserId: "manager",
    managementCredentialBinding: f.session.createManagementCredentialBinding("manager", "synthetic-hash") };
  const token = f.session.createSessionToken(claims); assert.equal((await f.session.validateSessionToken(token))?.role, role);
  f.state.management.passwordHash = "replacement-hash"; assert.equal(await f.session.validateSessionToken(token), null);
  await assert.rejects(f.session.refreshSessionCookie(f.session.verifySessionToken(token)!), /Unauthorized/);
  f.state.management.passwordHash = "synthetic-hash"; f.state.management.propertyId = "foreign"; assert.equal(await f.session.validateSessionToken(token), null);
  f.state.management.propertyId = "property"; f.state.management.role = "TENANT"; assert.equal(await f.session.validateSessionToken(token), null);
});
test("ADMIN and MAINTENANCE active-record checks remain authoritative", async () => {
  const f = fixture(); const a = f.session.createSessionToken(admin), w = f.session.createSessionToken(worker);
  assert.ok(await f.session.validateSessionToken(a)); assert.ok(await f.session.validateSessionToken(w));
  f.state.admin.isActive = false; f.state.worker.isActive = false;
  assert.equal(await f.session.validateSessionToken(a), null); assert.equal(await f.session.validateSessionToken(w), null);
});
test("TENANT assignment revocation and property/unit binding remain authoritative", async () => {
  const f = fixture(); const token = f.session.createSessionToken(tenant); assert.ok(await f.session.validateSessionToken(token));
  f.state.assignment.isCurrent = false; assert.equal(await f.session.validateSessionToken(token), null);
  f.state.assignment.isCurrent = true; f.state.assignment.unitId = "replacement-unit"; assert.equal(await f.session.validateSessionToken(token), null);
});
test("refresh, cookie security and logout retain their established contracts", async () => {
  const f = fixture(); const token = f.session.createSessionToken(admin); await f.session.refreshSessionCookie(f.session.verifySessionToken(token)!);
  assert.equal(f.writes[0].name, "rf_session"); assert.equal(f.writes[0].options.maxAge, 7 * 86400);
  assert.equal(f.writes[0].options.httpOnly, true); assert.equal(f.writes[0].options.secure, true); assert.equal(f.writes[0].options.sameSite, "lax");
  await f.session.clearSessionCookie(); assert.equal(f.cookies.get("rf_session"), ""); assert.equal(f.cookies.get("rf_admin_session"), "");
});
function instrumentation(env: Record<string, unknown>, session: Session) {
  return sourceModule<{ register(): Promise<void> }>(readFileSync(resolve(root, "instrumentation.ts"), "utf8"), { "@/lib/session": session }, env);
}
test("Node startup rejects invalid configuration and admits suitable configuration", async () => {
  await assert.rejects(instrumentation({ NEXT_RUNTIME: "nodejs" }, fixture(undefined).session).register(), /configuration/i);
  await instrumentation({ NEXT_RUNTIME: "nodejs" }, fixture().session).register();
});
test("Edge runtime and module loading do not execute Node validation", async () => {
  const hook = sourceModule<{ register(): Promise<void> }>(readFileSync(resolve(root, "instrumentation.ts"), "utf8"), {}, { NEXT_RUNTIME: "edge" });
  await hook.register();
});
test("installed Next registration awaits hook, propagates rejection and skips production build", async () => {
  const installed = readFileSync(resolve(root, "node_modules/next/dist/server/lib/router-utils/instrumentation-globals.external.js"), "utf8");
  async function run(phase: string | undefined, secret: unknown) {
    let calls = 0;
    const register = instrumentation({ NEXT_RUNTIME: "nodejs" }, fixture(secret).session).register;
    const next = sourceModule<{ ensureInstrumentationRegistered(dir: string, dist: string): Promise<void> }>(installed, {
      "node:path": { default: { join: () => "isolated-instrumentation" }, __esModule: true },
      "../../../lib/is-error": { default: (e: unknown) => e !== null && typeof e === "object", __esModule: true },
      "../../../lib/constants": { INSTRUMENTATION_HOOK_FILENAME: "instrumentation" },
      "../../../lib/interop-default": { interopDefault: (value: unknown) => value },
      "./instrumentation-node-extensions": { afterRegistration() {} },
      "isolated-instrumentation": { register: async () => { calls++; await register(); } },
    }, { NEXT_PHASE: phase });
    if (phase === "phase-production-build") { await next.ensureInstrumentationRegistered("isolated", ".next"); assert.equal(calls, 0); }
    else if (secret === undefined) { await assert.rejects(next.ensureInstrumentationRegistered("isolated", ".next"), /configuration/i); assert.equal(calls, 1); }
    else { await next.ensureInstrumentationRegistered("isolated", ".next"); assert.equal(calls, 1); }
  }
  await run("phase-production-build", undefined); await run(undefined, undefined); await run(undefined, key);
  const server = readFileSync(resolve(root, "node_modules/next/dist/server/next-server.js"), "utf8");
  assert.match(server, /await this\.runInstrumentationHookIfAvailable\(\)/);
  assert.match(readFileSync(resolve(root, "node_modules/next/dist/server/lib/render-server.js"), "utf8"), /await server\.prepare\(/);
  const start = readFileSync(resolve(root, "node_modules/next/dist/server/lib/start-server.js"), "utf8");
  assert.ok(start.indexOf("await getRequestHandlers(") < start.indexOf("handlersReady();"));
});


function launchFixture(register: (() => Promise<void>) | undefined, loadingError?: Error) {
  const env: { exitCode?: number } = {};
  const logs: string[] = [];
  let starts = 0;
  runInNewContext(readFileSync(resolve(root, "scripts/start-standalone.js"), "utf8"), {
    __dirname: resolve(root, "scripts"), process: env,
    console: { error: (message: string) => logs.push(message) },
    require(name: string) {
      if (name === "node:path") return { resolve };
      if (name === "next/dist/server/node-environment") return {};
      if (name.endsWith("instrumentation.js")) {
        if (loadingError) throw loadingError;
        return { register };
      }
      assert.equal(name, resolve(root, ".next/standalone/server.js"));
      starts++;
      return {};
    },
  });
  return { env, logs, starts: () => starts };
}

test("pre-launch wrapper awaits compiled validation before loading any HTTP server", async () => {
  let release!: () => void;
  const gate = new Promise<void>((done) => { release = done; });
  const launched = launchFixture(() => gate);
  assert.equal(launched.starts(), 0);
  release();
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(launched.starts(), 1);
  assert.equal(launched.env.exitCode, undefined);
  assert.deepEqual(launched.logs, []);
});

for (const failure of ["invalid configuration", "missing compiled hook", "missing register"]) {
  test("pre-launch wrapper fails closed and redacts " + failure, async () => {
    const diagnostic = new Error("synthetic-private-internal-diagnostic");
    const launched = failure === "missing compiled hook"
      ? launchFixture(undefined, diagnostic)
      : failure === "missing register"
        ? launchFixture(undefined)
        : launchFixture(async () => { throw diagnostic; });
    await new Promise<void>((done) => setImmediate(done));
    assert.equal(launched.starts(), 0);
    assert.equal(launched.env.exitCode, 1);
    assert.deepEqual(launched.logs, ["RentFray startup failed: session configuration could not be validated."]);
  });
}

for (const role of ["ADMIN", "OWNER", "MANAGER", "STAFF", "MAINTENANCE", "TENANT"] as const) {
  function strictFixture() {
    const f = fixture(); f.state.management.role = role;
    const claims = role === "ADMIN" ? admin : role === "TENANT" ? tenant : role === "MAINTENANCE" ? worker :
      { role, propertyId: "property", managementUserId: "manager",
        managementCredentialBinding: f.session.createManagementCredentialBinding("manager", "synthetic-hash") };
    f.cookies.set("rf_session", f.session.createSessionToken(claims));
    return f;
  }
  test(role + " strict authority distinguishes outage while default stays fail-closed", async () => {
    const f = strictFixture(); f.state.authorityFailure = true;
    assert.equal(await f.session.getSession(), null);
    await assert.rejects(f.session.getSession({ strictAuthority: true }), /synthetic database authority failure/);
    await assert.rejects(f.session.requireSession({ strictAuthority: true }), /synthetic database authority failure/);
    assert.equal(f.writes.length, 0);
  });
  test(role + " strict refresh preserves infrastructure failure without cookie writes", async () => {
    const f = strictFixture(); const session = await f.session.getSession({ strictAuthority: true }); assert.ok(session);
    f.state.authorityFailure = true;
    await assert.rejects(f.session.refreshSessionCookie(session, { strictAuthority: true }), /synthetic database authority failure/);
    await assert.rejects(f.session.refreshSessionCookie(session), /Unauthorized/);
    assert.equal(f.writes.length, 0);
  });
}
test("typed authorization errors distinguish missing authentication from wrong role", async () => {
  const f = fixture();
  await assert.rejects(f.session.requireRole("TENANT", { strictAuthority: true }),
    (e: unknown) => e instanceof f.session.SessionAuthorizationError && e.status === 401);
  f.cookies.set("rf_session", f.session.createSessionToken(admin));
  await assert.rejects(f.session.requireRole("TENANT", { strictAuthority: true }),
    (e: unknown) => e instanceof f.session.SessionAuthorizationError && e.status === 403);
  assert.equal(f.writes.length, 0);
});
