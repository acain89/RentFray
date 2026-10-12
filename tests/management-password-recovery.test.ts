import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import { NextResponse } from "next/server";

type Recovery = typeof import("../lib/managementPasswordRecovery");
type Row = Record<string, unknown>;
function load<T>(file: string, imports: Record<string, unknown>): T {
  const holder = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, { module: holder, exports: holder.exports, Buffer, Date, URL, Uint8Array,
    process: { env: { NODE_ENV: "production" } }, console: { error() {} },
    require(name: string) { assert.ok(name in imports, name); return imports[name]; } });
  return holder.exports as T;
}
function fixture(role = "OWNER") {
  const user = { id: "u", propertyId: "p", role, email: "person@example.invalid", emailVerifiedAt: new Date(),
    isActive: true, passwordHash: "old-hash", property: { id: "p", propertyCode: "1234", isActive: true } };
  const tokens: Row[] = [], audits: Row[] = [], trace: string[] = [];
  let matches = 1, failAudit = false, currentTime = new Date("2026-10-12T12:00:00Z");
  let tail = Promise.resolve();
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray) => {
      const text = sql.join("?"); trace.push(text);
      return text.includes("clock_timestamp") ? [{ now: currentTime }] : [{ id: "u" }];
    },
    managementUser: {
      findUnique: async () => user,
      findMany: async () => Array.from({ length: matches }, (_, index) => ({ id: index ? "other" : "u" })),
      update: async ({ data }: { data: Partial<typeof user> }) => { Object.assign(user, data); return user; },
    },
    managementPasswordResetToken: {
      create: async ({ data }: { data: Row }) => { tokens.push({ id: "t" + tokens.length, usedAt: null, ...data }); },
      findUnique: async ({ where }: { where: Row }) => tokens.find(t => t.tokenHash === where.tokenHash) ?? null,
      updateMany: async ({ data }: { data: Row }) => { for (const token of tokens) if (!token.usedAt) Object.assign(token, data); },
    },
    auditLog: { create: async ({ data }: { data: Row }) => { if (failAudit) throw Error("private SQL"); audits.push(data); } },
  };
  const db = { ...tx, property: { findUnique: async ({ where }: { where: Row }) => where.propertyCode === "1234" ? { id: "p" } : null },
    $transaction: async (work: (client: typeof tx) => Promise<unknown>, options: Row) => {
      assert.equal(options.isolationLevel, "ReadCommitted");
      const prior = tail; let release!: () => void; tail = new Promise<void>(done => { release = done; });
      await prior;
      const snapshot = structuredClone({ user, tokens, audits });
      try { return await work(tx); } catch (error) {
        Object.assign(user, snapshot.user); tokens.splice(0, tokens.length, ...snapshot.tokens); audits.splice(0, audits.length, ...snapshot.audits); throw error;
      } finally { release(); }
    },
  };
  class KnownError extends Error {}
  const recovery = load<Recovery>("lib/managementPasswordRecovery.ts", { "node:crypto": crypto,
    bcryptjs: { hash: async (password: string, rounds: number) => { assert.equal(rounds, 10); return "hashed:" + password; } },
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" }, PrismaClientKnownRequestError: KnownError } },
    "@/lib/prisma": { prisma: db }, "@/lib/session": { createManagementCredentialBinding: (id: string, hash: string) => crypto.createHash("sha256").update(id + hash).digest("hex") } });
  return { recovery, user, tokens, audits, trace, setMatches: (count: number) => { matches = count; },
    failAudit: () => { failAudit = true; }, advance: (milliseconds: number) => { currentTime = new Date(currentTime.getTime() + milliseconds); } };
}

for (const role of ["OWNER", "MANAGER", "STAFF"]) test(role + " recovery updates only intended credential and records no token in audit", async () => {
  const f = fixture(role); const issued = await f.recovery.issuePasswordRecovery("person@example.invalid", "1234"); assert.ok(issued);
  assert.match(issued.token, /^[a-f0-9]{64}$/); assert.equal(f.tokens[0].tokenHash, f.recovery.hashRecoveryToken(issued.token));
  assert.ok(!JSON.stringify(f.tokens).includes(issued.token));
  assert.equal(Number(f.tokens[0].expiresAt) - Number(f.tokens[0].createdAt), 1800000);
  assert.equal((await f.recovery.redeemPasswordRecovery(issued.token, "new-password"))?.propertyCode, "1234");
  assert.equal(f.user.passwordHash, "hashed:new-password"); assert.equal(f.user.role, role); assert.equal(f.audits.length, 1);
  assert.ok(!JSON.stringify(f.audits).includes(issued.token));
  assert.equal(await f.recovery.redeemPasswordRecovery(issued.token, "another-password"), null);
  assert.match(f.trace[0], /Property.*FOR SHARE/); assert.match(f.trace[1], /ManagementUser.*FOR UPDATE/);
});
for (const kind of ["unknown", "ambiguous", "unverified", "inactive", "inactive-property", "wrong-property", "wrong-email", "wrong-role"]) test("ineligible request: " + kind, async () => {
  const f = fixture();
  if (kind === "unknown") f.setMatches(0); if (kind === "ambiguous") f.setMatches(2);
  if (kind === "unverified") Object.assign(f.user, { emailVerifiedAt: null });
  if (kind === "inactive") f.user.isActive = false; if (kind === "inactive-property") f.user.property.isActive = false;
  if (kind === "wrong-email") f.user.email = "other@example.invalid"; if (kind === "wrong-role") f.user.role = "TENANT";
  assert.equal(await f.recovery.issuePasswordRecovery("person@example.invalid", kind === "wrong-property" ? "9999" : "1234"), null);
  assert.equal(f.tokens.length, 0);
});
for (const kind of ["expired", "email-changed", "password-changed", "disabled", "property-changed", "unverified"]) test("stale token rejected: " + kind, async () => {
  const f = fixture(); const issued = await f.recovery.issuePasswordRecovery("person@example.invalid", "1234"); assert.ok(issued);
  if (kind === "expired") f.advance(1800000); if (kind === "email-changed") f.user.email = "new@example.invalid";
  if (kind === "password-changed") f.user.passwordHash = "replacement"; if (kind === "disabled") f.user.isActive = false;
  if (kind === "property-changed") f.user.propertyId = "foreign"; if (kind === "unverified") Object.assign(f.user, { emailVerifiedAt: null });
  const original = f.user.passwordHash;
  assert.equal(await f.recovery.redeemPasswordRecovery(issued.token, "new-password"), null); assert.equal(f.user.passwordHash, original); assert.equal(f.audits.length, 0);
});
test("modeled concurrent issuance keeps only latest; redemption permits one success", async () => {
  const f = fixture(); const issued = await Promise.all([f.recovery.issuePasswordRecovery("person@example.invalid", "1234"), f.recovery.issuePasswordRecovery("person@example.invalid", "1234")]);
  assert.ok(issued[0] && issued[1]); assert.equal(await f.recovery.redeemPasswordRecovery(issued[0].token, "new-password"), null);
  const results = await Promise.all([f.recovery.redeemPasswordRecovery(issued[1].token, "new-password"), f.recovery.redeemPasswordRecovery(issued[1].token, "new-password")]);
  assert.equal(results.filter(Boolean).length, 1); assert.equal(f.audits.length, 1);
});
test("audit failure rolls back credential and token consumption", async () => {
  const f = fixture(); const issued = await f.recovery.issuePasswordRecovery("person@example.invalid", "1234"); assert.ok(issued); f.failAudit();
  await assert.rejects(f.recovery.redeemPasswordRecovery(issued.token, "new-password")); assert.equal(f.user.passwordHash, "old-hash"); assert.equal(f.tokens[0].usedAt, null);
});
test("bounded input, byte policy and same-origin checks", async () => {
  const { recovery: r } = fixture();
  const input = r.recoveryAccountInput({ email: " Person@Example.Invalid ", propertyCode: "1234" });
  assert.equal(input?.email, "person@example.invalid"); assert.equal(input?.propertyCode, "1234");
  for (const password of ["short", "x".repeat(73), "é".repeat(37)]) assert.equal(r.recoveryPasswordInput({ token: "a".repeat(64), password, confirmation: password }), null);
  assert.ok(r.recoveryPasswordInput({ token: "a".repeat(64), password: "é".repeat(36), confirmation: "é".repeat(36) }));
  assert.equal(await r.readRecoveryBody(new Request("https://www.rentfray.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(4097) })), null);
  assert.equal(r.recoverySameOrigin(new Request("http://srv-internal", { headers: { origin: "https://www.rentfray.com" } })), true);
  assert.equal(r.recoverySameOrigin(new Request("https://www.rentfray.com", { headers: { origin: "https://attacker.invalid" } })), false);
});

test("request HTTP responses conceal eligibility, delivery failure and scoped throttling", async () => {
  for (const kind of ["unknown", "eligible", "mail-failed", "throttled"]) {
    const f = fixture(); let sent = 0, admitted = 0;
    const route = load<{ POST(req: Request): Promise<Response> }>("app/api/manager/password-recovery/request/route.ts", {
      "next/server": { NextResponse }, "@/lib/managementPasswordRecovery": { ...f.recovery, issuePasswordRecovery: async () => kind === "unknown" ? null : { email: "person@example.invalid", token: "a".repeat(64) } },
      "@/lib/authThrottle": { admitPasswordRecoveryRequest: async () => { admitted++; return { admitted: kind !== "throttled" }; } },
      "@/lib/email": { sendPasswordRecoveryEmail: async () => { sent++; if (kind === "mail-failed") throw Error("private provider detail"); } },
    });
    const response = await route.POST(new Request("https://www.rentfray.com", { method: "POST", headers: { origin: "https://www.rentfray.com", "Content-Type": "application/json" }, body: JSON.stringify({ email: "person@example.invalid", propertyCode: "1234" }) }));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, message: f.recovery.RECOVERY_CONFIRMATION });
    assert.equal(admitted, 1); assert.equal(sent, kind === "unknown" || kind === "throttled" ? 0 : 1); assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("dedicated recovery authority exists without reusing verification tokens", () => {
  const source = readFileSync("lib/managementPasswordRecovery.ts", "utf8");
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /managementPasswordResetToken/);
  assert.ok(!source.includes("emailVerificationToken"));
});
