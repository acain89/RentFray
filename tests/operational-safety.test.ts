import type * as SafetyModule from "../scripts/operational-safety";
import type { Prisma } from "@prisma/client";
import * as path from "node:path";
import { stage2Load } from "./representative-stage2-fixture";
import { parseCreatorPlan, verifyMaintenanceIdentity, assertCreatorMutation, maintenanceClient } from "../scripts/maintenance-safety";
import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseManifest, validateLocalEvidence, validateServerIdentity, verifyBeforeWork, assertMutationScope, boundedWhere,
  disposableClient, requireOperationalReview, type LocalEvidence } from "../scripts/operational-safety";

const nonce = "a".repeat(32), root = join(tmpdir(), "rentfray-disposable-" + nonce);
const input = { version: 1, operation: "prisma-seed", root, nonce, databaseUrl: `postgresql://rf_disposable_${nonce}@127.0.0.1:55461/rf_disposable_${nonce}`,
  database: "rf_disposable_" + nonce, username: "rf_disposable_" + nonce, port: 55461, propertyCodes: ["1234"] };
const manifest = parseManifest(input, "prisma-seed");
const evidence: LocalEvidence = { tempRoot: tmpdir(), manifestPath: join(root, "manifest.json"), realRoot: root, realData: join(root, "data"), regularManifest: true,
  pgVersion: "16", pid: 1234, pidAlive: true, startedEpoch: 1700000000, port: 55461, pidDataDirectory: join(root, "data") };
const identity = { database: input.database, username: input.username, address: "127.0.0.1", port: 55461, clusterName: "rentfray-disposable-" + nonce,
  dataDirectory: join(root, "data"), startedAt: new Date(1700000000000) };
test("positive isolation requires filesystem, process and independently queried server identity", async () => {
  const events: string[] = [];
  await verifyBeforeWork(manifest, evidence, async () => { events.push("read-only identity"); return identity; }, async () => { events.push("authorized work"); });
  assert.deepEqual(events, ["read-only identity", "authorized work"]);
});
for (const mutation of [{ databaseUrl: "postgresql://owner@remote.invalid/live" }, { operation: "scale-seed" }, { propertyCodes: [] }, { propertyCodes: ["other"] },
  { databaseUrl: input.databaseUrl + "?host=remote.invalid" }, { databaseUrl: input.databaseUrl + "?connection_limit=100" }, { nonce: "bad" }]) {
  test(`unsafe manifest rejected before identity/mutation: ${Object.keys(mutation).join()}`, () => assert.throws(() => parseManifest({ ...input, ...mutation }, "prisma-seed")));
}
for (const mutation of [{ regularManifest: false }, { pidAlive: false }, { realData: join(root, "other") }, { manifestPath: join(root, "other.json") }, { port: 55462 }, { pid: 0 }]) {
  test(`invalid local proof cannot reach a connection or mutation: ${Object.keys(mutation).join()}`, async () => {
    let reads = 0, writes = 0;
    await assert.rejects(verifyBeforeWork(manifest, { ...evidence, ...mutation }, async () => { reads++; return identity; }, async () => { writes++; }));
    assert.equal(reads, 0); assert.equal(writes, 0);
  });
}
for (const mutation of [{ database: "live" }, { username: "owner" }, { address: "remote.invalid" }, { port: 5432 }, { dataDirectory: join(root, "other") },
  { clusterName: "production" }, { startedAt: new Date(0) }]) {
  test(`server mismatch blocks all work: ${Object.keys(mutation).join()}`, async () => {
    let writes = 0;
    await assert.rejects(verifyBeforeWork(manifest, evidence, async () => ({ ...identity, ...mutation }), async () => { writes++; }));
    assert.equal(writes, 0);
  });
}
test("a name, flag, or manifest alone never grants a client capability", () => {
  assert.throws(() => disposableClient("prisma-seed"), /DISPOSABLE_CAPABILITY_REQUIRED/);
  assert.throws(() => requireOperationalReview("legacy"), /OPERATIONAL_REVIEW_REQUIRED/);
  assert.doesNotThrow(() => validateLocalEvidence(manifest, evidence));
  assert.doesNotThrow(() => validateServerIdentity(manifest, evidence, identity));
});
for (const where of [undefined, {}, { status: "PAID" }, { id: { not: null } }, { OR: [{ id: "one" }, {}] }, { id: { in: [] } }]) {
  test(`unfiltered or ambiguous destructive predicate rejected: ${JSON.stringify(where)}`, () => {
    assert.equal(boundedWhere(where), false);
    for (const action of ["delete", "deleteMany", "update", "updateMany"]) assert.throws(() => assertMutationScope(action, { where }));
  });
}
test("explicit scopes remain usable; raw DML cannot bypass filters", () => {
  for (const where of [{ id: "one" }, { propertyId: "p" }, { propertyCode: "1234" }, { OR: [{ id: "one" }, { id: "two" }] }]) assert.doesNotThrow(() => assertMutationScope("deleteMany", { where }));
  assert.throws(() => assertMutationScope("executeRaw", { query: 'DELETE FROM "LedgerEntry"' }));
  assert.throws(() => assertMutationScope("queryRaw", { query: 'WITH changed AS (DELETE FROM "Payment" RETURNING *) SELECT * FROM changed' }));
  assert.doesNotThrow(() => assertMutationScope("queryRaw", { query: 'SELECT "id" FROM "Property" WHERE "id" = $1 FOR UPDATE NOWAIT' }));
});
test("retired repairs are absent and seed never erases existing data", () => {
  assert.equal(existsSync("fix-stripe.js"), false); assert.equal(existsSync("fix-tuc.js"), false);
  const seed = readFileSync("prisma/seed.ts", "utf8");
  assert.match(seed, /assertEmptySeedDatabase/); assert.doesNotMatch(seed, /deleteMany/);
});
test("entry point refuses a missing capability before utility code is imported", () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "NODE_OPTIONS"].includes(key.toUpperCase())));
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/run-operational.ts", "prisma-seed", "--execute"], { env: { ...env, NODE_ENV: "test" }, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 2); assert.match(result.stderr, /DISPOSABLE_MANIFEST_REQUIRED/);
});

const creatorPlanInput = { operation: "create-creator", databaseUrl: "postgresql://operator@reviewed.invalid/reviewed?sslmode=require&sslaccept=strict",
  name: "Reviewed Creator", slug: "reviewed-creator", expected: { database: "reviewed", username: "operator", address: "192.0.2.1", port: 5432,
    systemIdentifier: "1234567890123456789", dataDirectory: "/reviewed/data" } };
test("maintenance requires an exact verified server and one explicit creator target", () => {
  const plan = parseCreatorPlan(creatorPlanInput);
  assert.doesNotThrow(() => verifyMaintenanceIdentity(plan, plan.expected));
  assert.throws(() => verifyMaintenanceIdentity(plan, { ...plan.expected, systemIdentifier: "different" }));
  assert.throws(() => verifyMaintenanceIdentity(plan, { ...plan.expected, database: "other" }));
  assert.throws(() => maintenanceClient("create-creator"));
  assert.doesNotThrow(() => assertCreatorMutation(plan, "Creator", "create", { data: { name: plan.name, slug: plan.slug, startsAt: new Date(), expiresAt: new Date(), createdAt: new Date() } }));
  for (const [model, action, args] of [["Creator", "deleteMany", {}], ["Property", "create", {}], ["Creator", "create", { data: { name: plan.name, slug: "other" } }]] as const) {
    assert.throws(() => assertCreatorMutation(plan, model, action, args));
  }
});
for (const suffix of ["sslmode=prefer&sslaccept=strict", "sslmode=require&sslaccept=accept_invalid_certs", "sslmode=require&sslaccept=strict&sslmode=disable", "sslmode=require&sslaccept=strict&host=other"]) {
  test(`unsafe maintenance transport options rejected: ${suffix}`, () => assert.throws(() => parseCreatorPlan({ ...creatorPlanInput, databaseUrl: "postgresql://operator@reviewed.invalid/reviewed?" + suffix })));
}

function mockedBootstrap(actualIdentity: unknown = identity) {
  const events: string[] = [];
  let middleware: Prisma.Middleware | undefined;
  class Client {
    async $transaction(work: (tx: { $executeRaw(...args: unknown[]): Promise<number>; $queryRaw(...args: unknown[]): Promise<unknown[]> }) => Promise<unknown>) {
      events.push("identity transaction");
      return work({ $executeRaw: async () => { events.push("read-only"); return 0; }, $queryRaw: async () => [actualIdentity] });
    }
    $use(value: Prisma.Middleware) { middleware = value; }
    async $disconnect() { events.push("disconnect"); }
  }
  const files: Record<string, string> = {
    [join(root, "manifest.json")]: JSON.stringify(input),
    [join(root, "data", "postmaster.pid")]: `1234\n${join(root, "data")}\n1700000000\n55461\n`,
    [join(root, "data", "PG_VERSION")]: "16",
  };
  const safety = stage2Load<typeof SafetyModule>("scripts/operational-safety.ts", {
    "@prisma/client": { PrismaClient: Client, Prisma: { dmmf: { datamodel: { models: [] } } } },
    "node:path": path, "node:os": { tmpdir },
    "node:fs/promises": {
      readFile: async (name: string) => { assert.ok(name in files, name); return files[name]; },
      realpath: async (name: string) => path.resolve(name),
      lstat: async () => ({ isFile: () => true, isSymbolicLink: () => false }),
      open: async (_name: string, flags: string) => { assert.equal(flags, "wx"); events.push("lock"); return { close: async () => { events.push("unlock"); } }; },
      unlink: async () => { events.push("unlink"); },
    },
  }, {}, { process: { env: {}, kill: (pid: number, signal: number) => { assert.equal(pid, 1234); assert.equal(signal, 0); } } });
  const invoke = async (action: Prisma.PrismaAction, args: unknown) => {
    assert.ok(middleware, "Mutation middleware must be installed only after verification");
    return middleware({ action, args, dataPath: [], runInTransaction: false }, async () => { events.push("mutation"); return 1; });
  };
  return { safety, events, invoke };
}
test("mocked bootstrap acquires an exclusive capability only after read-only identity verification and revokes it on close", async () => {
  const f = mockedBootstrap();
  await assert.rejects(f.safety.openDisposableUtility("prisma-seed", join(root, "manifest.json"), false), /DRY_RUN/);
  assert.equal(f.events.length, 0);
  const lease = await f.safety.openDisposableUtility("prisma-seed", join(root, "manifest.json"), true);
  assert.deepEqual(f.events, ["lock", "identity transaction", "read-only"]);
  assert.ok(f.safety.disposableClient("prisma-seed"));
  await assert.rejects(f.safety.openDisposableUtility("scale-seed", "other", true), /ALREADY_ACTIVE/);
  await assert.rejects(f.invoke("deleteMany", {}), /UNSCOPED_MUTATION/);
  assert.equal(f.events.includes("mutation"), false);
  await f.invoke("deleteMany", { where: { propertyId: "isolated-property" } });
  assert.equal(f.events.filter(event => event === "mutation").length, 1);
  await lease.close();
  assert.throws(() => f.safety.disposableClient("prisma-seed"), /CAPABILITY_REQUIRED/);
  await assert.rejects(f.invoke("deleteMany", { where: { propertyId: "isolated-property" } }), /CAPABILITY_EXPIRED/);
  assert.deepEqual(f.events.slice(-3), ["disconnect", "unlock", "unlink"]);
});
test("mocked server mismatch releases its lock without installing mutation capability", async () => {
  const f = mockedBootstrap({ ...identity, database: "existing-database" });
  await assert.rejects(f.safety.openDisposableUtility("prisma-seed", join(root, "manifest.json"), true), /SERVER_IDENTITY/);
  assert.throws(() => f.safety.disposableClient("prisma-seed"), /CAPABILITY_REQUIRED/);
  assert.equal(f.events.includes("mutation"), false);
  assert.deepEqual(f.events.slice(-3), ["disconnect", "unlock", "unlink"]);
});

test("legacy HTTP mutation harness is quarantined before its first request", () => {
  const source = readFileSync("smoke-test.ps1", "utf8");
  assert.ok(source.indexOf('throw "OPERATIONAL_REVIEW_REQUIRED') > 0);
  assert.ok(source.indexOf('throw "OPERATIONAL_REVIEW_REQUIRED') < source.indexOf("$BaseUrl ="));
});

test("unsafe raw primitives and administrative side-effect SELECT calls cannot bypass the mutation boundary", () => {
  for (const action of ["queryRawUnsafe", "executeRawUnsafe"]) assert.throws(() => assertMutationScope(action, ["SELECT 1"]), /UNSAFE_RAW/);
  for (const query of ["SELECT pg_terminate_backend(pid) FROM pg_stat_activity", "SELECT set_config('role', 'owner', false)", "CALL maintenance()", "SET ROLE owner"]) {
    assert.throws(() => assertMutationScope("queryRaw", { query }));
  }
});
