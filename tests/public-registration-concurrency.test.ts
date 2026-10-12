import { test } from "node:test";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Row = Record<string, unknown>;
type Reply = { status: number; body: Row; cookies: { set(): void } };
const root = resolve(__dirname, "..");
const routeFile = "app/api/setup/create-account/route.ts";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function fixture(options: { competing?: boolean; sameCode?: boolean; failure?: string; error?: unknown; existing?: Row[]; holdCreation?: boolean } = {}) {
  const state = { property: [] as Row[], managementUser: [...(options.existing ?? [])], propertySettings: [] as Row[], paymentConnectionStatus: [] as Row[], creatorReferral: [] as Row[] };
  const trace: string[] = [], emails: Row[] = [], logs: unknown[][] = [];
  const lookups: Array<{ where: { OR: Row[] }; locked: boolean; transaction: boolean }> = [];
  const locks = new Map<string, Promise<void>>();
  const beforeRead = deferred(), creationEntered = deferred(), releaseCreation = deferred();
  let preReads = 0, counter = 0, codeCounter = 0, hashes = 0, cleared = 0;
  const transactionOptions: Row[] = [];
  const find = (where: { OR: Row[] }) => state.managementUser.find(row => where.OR.some(clause => Object.entries(clause).every(([key, value]) => row[key] === value))) ?? null;
  const db = {
    managementUser: { findFirst: async ({ where }: { where: { OR: Row[] } }) => {
      lookups.push({ where, locked: false, transaction: false });
      const row = find(where);
      if (options.competing) { if (++preReads === 2) beforeRead.resolve(); await beforeRead.promise; }
      return row;
    } },
    $transaction: async (fn: (tx: ReturnType<typeof transaction>) => Promise<unknown>, settings: Row) => {
      transactionOptions.push(settings);
      const tx = transaction();
      try {
        const result = await fn(tx);
        if (tx.pending.property.some(p => state.property.some(existing => existing.propertyCode === p.propertyCode))) {
          throw Object.assign(new Error("PRIVATE_SQL_PROPERTY_CODE_DIAGNOSTIC"), { code: "P2002" });
        }
        for (const model of Object.keys(state) as Array<keyof typeof state>) state[model].push(...tx.pending[model]);
        trace.push("commit");
        return result;
      } finally { tx.release(); }
    },
  };
  function transaction() {
    const pending = { property: [] as Row[], managementUser: [] as Row[], propertySettings: [] as Row[], paymentConnectionStatus: [] as Row[], creatorReferral: [] as Row[] };
    const releases: Array<() => void> = [];
    let locked = false;
    function maybeFail(stage: string) {
      if (options.failure === stage) throw options.error ?? new Error("PRIVATE_INTERNAL_DIAGNOSTIC password=synthetic token=private");
    }
    return {
      pending,
      release() { releases.forEach(release => release()); },
      async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        trace.push("lock-request"); maybeFail("lock");
        assert.equal(strings.join("?"), "SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))");
        assert.deepEqual(values, ["public-registration", String(values[1]).trim().toLowerCase()]);
        assert.ok(!strings.join("").includes(String(values[1])));
        assert.ok(hashes > 0, "Hash before holding the database lock");
        const key = JSON.stringify(values), prior = locks.get(key) ?? Promise.resolve(), gate = deferred();
        locks.set(key, prior.then(() => gate.promise));
        await prior; locked = true; releases.push(gate.resolve); trace.push("lock-acquired");
      },
      property: {
        findUnique: async ({ where }: { where: Row }) => state.property.find(p => p.propertyCode === where.propertyCode) ?? null,
        create: async ({ data }: { data: Row }) => {
          maybeFail("property"); trace.push("property-create");
          const row = { ...data, id: "p" + ++counter }; pending.property.push(row);
          if (options.holdCreation) { creationEntered.resolve(); await releaseCreation.promise; }
          return row;
        },
      },
      managementUser: {
        findFirst: async ({ where }: { where: { OR: Row[] } }) => { lookups.push({ where, locked, transaction: true }); trace.push("duplicate-check"); return find(where); },
        create: async ({ data }: { data: Row }) => { maybeFail("owner"); const row = { ...data, id: "m" + counter }; pending.managementUser.push(row); return row; },
      },
      propertySettings: { create: async ({ data }: { data: Row }) => { maybeFail("settings"); pending.propertySettings.push(data); } },
      paymentConnectionStatus: { create: async ({ data }: { data: Row }) => { maybeFail("connection"); pending.paymentConnectionStatus.push(data); } },
      creatorReferral: { create: async ({ data }: { data: Row }) => pending.creatorReferral.push(data) },
    };
  }
  const fakeMath = Object.create(Math) as Math;
  fakeMath.random = () => options.sameCode ? 0 : codeCounter++ / 9000;
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: Row, config?: { status?: number }): Reply => ({ status: config?.status ?? 200, body, cookies: { set() { cleared++; } } }) } },
    "next/headers": { cookies: async () => ({ get: () => ({ value: "synthetic-referral" }) }) },
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" } } },
    "@/lib/prisma": { prisma: db },
    bcryptjs: { hash: async (password: string, cost: number) => { assert.equal(cost, 12); assert.equal(password, "synthetic-password"); hashes++; trace.push("hash"); return "synthetic-hash"; } },
    "@/lib/creatorReferrals": { REFERRAL_COOKIE: "synthetic-referral", referralCookieOptions: {}, attributeCreator: async (tx: ReturnType<typeof transaction>, cookie: string, property: Row) => {
      assert.equal(cookie, "synthetic-referral"); if (options.failure === "referral") throw new Error("PRIVATE_REFERRAL_DIAGNOSTIC"); await tx.creatorReferral.create({ data: { propertyId: property.id } }); return true;
    } },
    "@/lib/email": { sendVerificationEmail: async (input: Row) => {
      assert.ok(trace.includes("commit")); assert.ok(state.managementUser.some(user => user.id === input.managementUserId && user.email === input.email));
      emails.push(input); if (options.failure === "email") throw options.error ?? new Error("PRIVATE_EMAIL_DIAGNOSTIC token=private");
    } },
  };
  const holder = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(root, routeFile), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, { module: holder, exports: holder.exports, Math: fakeMath, Error, console: { error: (...args: unknown[]) => logs.push(args.map(value => value instanceof Error ? value.message : value)) },
    require(name: string) { assert.ok(name in imports, "Unexpected isolated dependency " + name); return imports[name]; } });
  const handler = holder.exports as { POST(request: { json(): Promise<Row> }): Promise<Reply> };
  const submit = (email = "same@example.invalid", overrides: Row = {}) => handler.POST({ json: async () => ({ firstName: "Test", lastName: "Owner", email, password: "synthetic-password", ...overrides }) });
  return { state, trace, lookups, transactionOptions, emails, logs, submit, creationEntered, releaseCreation, cleared: () => cleared, malformed: () => handler.POST({ json: async () => { throw new Error("PRIVATE_PARSER_DIAGNOSTIC"); } }) };
}

for (const [label, email] of [["identical", "same@example.invalid"], ["case", "SAME@EXAMPLE.INVALID"], ["whitespace", "  same@example.invalid  "], ["rapid duplicate", "same@example.invalid"]]) {
  test("concurrent " + label + " registration creates one account and sends one verification", async () => {
    const f = fixture({ competing: true });
    const replies = await Promise.all([f.submit(), f.submit(email)]);
    assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
    for (const model of Object.keys(f.state) as Array<keyof typeof f.state>) assert.equal(f.state[model].length, 1, model);
    assert.equal(f.emails.length, 1); assert.equal(f.cleared(), 1);
    const blocked = replies.find(r => r.status === 409)!;
    assert.equal(blocked.body.error, "An account with that email already exists.");
    assert.equal(f.logs.length, 0);
  });
}
test("lookup uses transaction client only after lock and transaction is Read Committed", async () => {
  const f = fixture(); assert.equal((await f.submit()).status, 200);
  assert.equal(f.lookups.length, 1); assert.equal(f.lookups[0].transaction, true); assert.equal(f.lookups[0].locked, true);
  assert.deepEqual(JSON.parse(JSON.stringify(f.lookups[0].where)), { OR: [{ email: "same@example.invalid" }, { username: "same@example.invalid" }] });
  assert.equal(f.transactionOptions[0].isolationLevel, "ReadCommitted");
  assert.equal(f.transactionOptions[0].maxWait, 10000); assert.equal(f.transactionOptions[0].timeout, 20000);
  assert.ok(f.trace.indexOf("hash") < f.trace.indexOf("lock-acquired"));
  assert.ok(f.trace.indexOf("lock-acquired") < f.trace.indexOf("duplicate-check"));
  assert.ok(f.trace.indexOf("duplicate-check") < f.trace.indexOf("property-create"));
});
test("network retry after committed signup returns conflict without another email", async () => {
  const f = fixture(); assert.equal((await f.submit()).status, 200); assert.equal((await f.submit()).status, 409);
  assert.equal(f.state.property.length, 1); assert.equal(f.emails.length, 1);
});
test("different-email registrations can progress while another registration holds its lock", { timeout: 5000 }, async () => {
  const f = fixture({ holdCreation: true });
  const first = f.submit("first@example.invalid"); await f.creationEntered.promise;
  const second = f.submit("second@example.invalid");
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(f.trace.filter(v => v === "property-create").length, 2);
  f.releaseCreation.resolve(); assert.deepEqual((await Promise.all([first, second])).map(r => r.status), [200, 200]);
  assert.equal(f.state.property.length, 2); assert.equal(f.emails.length, 2);
});
for (const stage of ["property", "referral", "owner", "settings", "connection"]) test(stage + " failure rolls back all account/referral writes and releases lock", async () => {
  const config = { failure: stage }; const f = fixture(config);
  assert.equal((await f.submit()).status, 500);
  for (const rows of Object.values(f.state)) assert.equal(rows.length, 0);
  assert.equal(f.emails.length, 0); assert.equal(f.cleared(), 0);
  config.failure = ""; assert.equal((await f.submit()).status, 200); assert.equal(f.emails.length, 1);
});
for (const error of [Object.assign(new Error("PRIVATE_PRISMA_DIAGNOSTIC password=private"), { code: "P2010" }),
  Object.assign(new Error("PRIVATE_POSTGRES_DIAGNOSTIC SQL credentials=private"), { code: "40P01" }),
  new Error("PRIVATE_INTERNAL_DIAGNOSTIC token=private")]) test("unexpected " + String(error.message.split(" ")[0]) + " is generic and safely logged", async () => {
  const f = fixture({ failure: "settings", error }); const reply = await f.submit();
  assert.equal(reply.status, 500); assert.equal(reply.body.error, "Could not create your account.");
  assert.ok(!JSON.stringify(reply).includes("PRIVATE_")); assert.ok(!JSON.stringify(f.logs).includes("PRIVATE_"));
  assert.ok(!JSON.stringify(f.logs).includes("synthetic-password")); assert.ok(f.logs.length > 0);
  for (const rows of Object.values(f.state)) assert.equal(rows.length, 0);
});
test("lock failure returns generic failure with no partial records or automatic retry", async () => {
  const f = fixture({ failure: "lock", error: Object.assign(new Error("PRIVATE_TIMEOUT"), { code: "P2028" }) });
  assert.equal((await f.submit()).status, 500); assert.equal(f.transactionOptions.length, 1);
  for (const rows of Object.values(f.state)) assert.equal(rows.length, 0);
  assert.equal(f.emails.length, 0); assert.ok(!JSON.stringify(f.logs).includes("PRIVATE_TIMEOUT"));
});
test("existing memberships remain intact and block public signup under email OR username policy", async () => {
  const existing = [{ id: "one", propertyId: "p1", email: "same@example.invalid", username: "same@example.invalid", role: "MANAGER" },
    { id: "two", propertyId: "p2", email: "same@example.invalid", username: "same@example.invalid", role: "STAFF" }];
  const f = fixture({ existing }); assert.equal((await f.submit()).status, 409); assert.deepEqual(f.state.managementUser, existing);
  assert.equal(f.state.property.length, 0); assert.equal(f.emails.length, 0);
  const usernameOnly = fixture({ existing: [{ username: "same@example.invalid", email: null, isActive: false }] });
  assert.equal((await usernameOnly.submit()).status, 409);
});
test("property-code collision preserves uniqueness, rolls back loser and reveals no diagnostics", async () => {
  const f = fixture({ sameCode: true, competing: true });
  const replies = await Promise.all([f.submit("a@example.invalid"), f.submit("b@example.invalid")]);
  assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 500]);
  const failed = replies.find(reply => reply.status === 500)!; assert.equal(failed.status, 500); assert.equal(failed.body.error, "Could not create your account.");
  for (const rows of Object.values(f.state)) assert.equal(rows.length, 1);
  assert.equal(f.emails.length, 1); assert.ok(!JSON.stringify(f.logs).includes("PRIVATE_SQL"));
});
test("verification-email failure preserves committed identity and redacts delivery diagnostics", async () => {
  const f = fixture({ failure: "email" }); const reply = await f.submit();
  assert.equal(reply.status, 200); assert.equal(reply.body.verificationEmailSent, false);
  assert.equal(f.state.property.length, 1); assert.equal(f.emails[0].managementUserId, f.state.managementUser[0].id);
  assert.equal(f.emails[0].propertyCode, f.state.property[0].propertyCode);
  assert.ok(!JSON.stringify(f.logs).includes("PRIVATE_EMAIL"));
});
for (const [payload, message] of [[{ firstName: "" }, "First name is required."], [{ lastName: "" }, "Last name is required."],
  [{ email: "invalid" }, "Enter a valid email address."], [{ password: "short" }, "Password must be at least 8 characters."]] as Array<[Row, string]>) {
  test("controlled validation: " + message, async () => {
    const f = fixture(); const reply = await f.submit("same@example.invalid", payload);
    assert.equal(reply.status, 400); assert.equal(reply.body.error, message); assert.equal(f.transactionOptions.length, 0);
  });
}
test("malformed JSON is generic without leaking parser diagnostics", async () => {
  const f = fixture(); const reply = await f.malformed();
  assert.equal(reply.status, 500); assert.equal(reply.body.error, "Could not create your account.");
});


test("waiting same-email transaction observes the committed account after lock release", { timeout: 5000 }, async () => {
  const f = fixture({ holdCreation: true });
  const first = f.submit(); await f.creationEntered.promise;
  const second = f.submit(" SAME@EXAMPLE.INVALID ");
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(f.trace.filter(value => value === "lock-request").length, 2);
  assert.equal(f.trace.filter(value => value === "lock-acquired").length, 1);
  assert.equal(f.lookups.length, 1); assert.equal(f.state.property.length, 0);
  f.releaseCreation.resolve();
  assert.deepEqual((await Promise.all([first, second])).map(reply => reply.status), [200, 409]);
  assert.equal(f.state.property.length, 1); assert.equal(f.emails.length, 1);
  assert.equal(f.lookups.length, 2); assert.ok(f.lookups.every(lookup => lookup.locked && lookup.transaction));
});

test("actual verification-token helper retains the committed OWNER identity and hashed tokens", async () => {
  const f = fixture(); assert.equal((await f.submit()).status, 200);
  const ownerId = f.emails[0].managementUserId;
  const records: Row[] = [];
  const imports: Record<string, unknown> = {
    crypto,
    "@/lib/prisma": { prisma: {
      emailVerificationToken: {
        deleteMany: async ({ where }: { where: Row }) => { assert.equal(where.managementUserId, ownerId); assert.equal(where.usedAt, null); records.length = 0; },
        create: async ({ data }: { data: Row }) => { records.push(data); return data; },
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } },
    "@/lib/resend": { EMAIL_FROM: "isolated.invalid", resend: new Proxy({}, { get() { throw Error("No email service permitted"); } }) },
  };
  const holder = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(root, "lib/email.ts"), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, { module: holder, exports: holder.exports, Date,
    require(name: string) { assert.ok(name in imports, name); return imports[name]; } });
  const email = holder.exports as typeof import("../lib/email");
  const token = await email.createEmailVerificationToken(String(ownerId));
  assert.equal(records.length, 1); assert.equal(records[0].managementUserId, ownerId);
  assert.equal(records[0].tokenHash, email.hashEmailVerificationToken(token));
  assert.notEqual(records[0].tokenHash, token); assert.equal(token.length, 64);
  await email.createEmailVerificationToken(String(ownerId));
  assert.equal(records.length, 1); assert.equal(records[0].managementUserId, ownerId);
});
