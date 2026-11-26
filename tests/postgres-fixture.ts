import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { openDisposableUtility, parseManifest, assertMutationScope, isRecord } from "../scripts/operational-safety";

// An explicit manifest is the only opt-in. DATABASE_URL and application .env files
// never select a fixture. Hold the production verifier's exclusive lease throughout.
const normalizedSql = (sql: string) => sql.replace(/\$[0-9]+/g, "?").replace(/\s+/g, " ").trim();
// Exact existing authentication statements: parameterized one-key insertion and
// representative-only expired cleanup, bounded to 25 locked rows. No arbitrary DML.
const authenticationSql = new Set([
  normalizedSql(`INSERT INTO "AuthThrottleBucket" ("key", "attemptCount", "windowExpiresAt") VALUES (?, 0, TIMESTAMPTZ 'epoch') ON CONFLICT ("key") DO NOTHING`),
  normalizedSql(`DELETE FROM "AuthThrottleBucket" WHERE "key" IN ( SELECT "key" FROM "AuthThrottleBucket" WHERE "key" LIKE 'representative:%' AND "windowExpiresAt" <= clock_timestamp() ORDER BY "windowExpiresAt", "key" LIMIT 25 FOR UPDATE SKIP LOCKED)`),
]);
export const postgresManifest = process.env.RF_POSTGRES_TEST_CONFIG;
export async function openPostgresFixture(suite: string) {
  assert.ok(postgresManifest, "RF_POSTGRES_TEST_CONFIG is required");
  const config: unknown = JSON.parse(readFileSync(postgresManifest, "utf8"));
  assert.ok(config && typeof config === "object" && Object.hasOwn(config, suite));
  const manifestPath: unknown = Reflect.get(config, suite);
  assert.equal(typeof manifestPath, "string");
  assert.ok(typeof manifestPath === "string");
  const manifest = parseManifest(JSON.parse(readFileSync(manifestPath, "utf8")), "qa-audit");
  const lease = await openDisposableUtility("qa-audit", manifestPath, true);
  const db = new PrismaClient({ datasources: { db: { url: manifest.databaseUrl } }, log: [{ emit: "event", level: "query" }] });
  const queries: string[] = [];
  db.$on("query", event => queries.push(event.query));
  let active = true;
  try {
    const [identity] = await db.$queryRaw<{ directory: string; database: string; username: string; port: number; cluster: string; address: string; startedAt: Date }[]>`
      SELECT current_setting('data_directory') AS directory, current_database() AS database,
      current_user AS username, inet_server_port() AS port, current_setting('cluster_name') AS cluster,
      host(inet_server_addr()) AS address, pg_postmaster_start_time() AS "startedAt"`;
    assert.equal(resolve(identity.directory), resolve(manifest.root, "data"));
    assert.equal(identity.database, manifest.database); assert.equal(identity.username, manifest.username);
    assert.equal(identity.port, manifest.port); assert.equal(identity.cluster, "rentfray-disposable-" + manifest.nonce);
    assert.equal(identity.address, "127.0.0.1");
    const startedEpoch = Number(readFileSync(resolve(manifest.root, "data/postmaster.pid"), "utf8").split(/\r?\n/)[2]);
    assert.equal(Math.floor(identity.startedAt.getTime() / 1000), startedEpoch);
    // These are test clients, not operational utilities: they exercise rejected SQL
    // constraints and collect real query events. No application target is accepted.
    db.$use(async (params, next) => {
      assert.ok(active, "Disposable fixture capability expired");
      const args: unknown = params.args;
      // Read-only transactions are required by the reporting acceptance contracts.
      const first: unknown = Array.isArray(args) ? args[0] : undefined;
      const sql = typeof first === "string" ? first : Array.isArray(first) ? first.join("?") : isRecord(first) && typeof first.sql === "string" ? first.sql : "";
      const readOnly = params.action === "executeRaw" && sql.trim() === "SET TRANSACTION READ ONLY";
      const reviewedAuthentication = params.action === "executeRaw" && authenticationSql.has(normalizedSql(sql));
      if (!readOnly && !reviewedAuthentication) {
        // The application also scopes throttling by its schema primary key and
        // ledger fee reconciliation by an indexed Payment foreign key. Validate
        // these bounded identities only on this verified test client; never alter
        // the executed WHERE clause or the production operational guard.
        const field = params.model === "AuthThrottleBucket" ? "key" : params.model === "LedgerEntry" ? "paymentId" : undefined;
        const identity: unknown = field && isRecord(args) && isRecord(args.where) ? args.where[field] : undefined;
        if (isRecord(args) && typeof identity === "string" && identity.trim()) {
          assertMutationScope(params.action, { ...args, where: { id: identity } });
        } else assertMutationScope(params.action, args);
      }
      return next(params);
    });
    return { db, runtime: { Prisma }, manifest, queries, async close() {
      active = false; try { await db.$disconnect(); } finally { await lease.close(); }
    } };
  } catch (error) { await db.$disconnect(); await lease.close(); throw error; }
}
export async function representativeSentinels(db: PrismaClient): Promise<Record<string, string>> {
  await db.property.create({ data: { id: "stage1-sentinel-property", name: "Protected synthetic sentinel", propertyCode: "stage1-sentinel" } });
  await db.unit.create({ data: { id: "stage1-sentinel-unit", propertyId: "stage1-sentinel-property", unitNumber: "sentinel" } });
  await db.payment.create({ data: { id: "stage1-sentinel-payment", propertyId: "stage1-sentinel-property", unitId: "stage1-sentinel-unit", amountCents: 12345, status: "PAID", paymentMethod: "ACH" } });
  await db.ledgerEntry.create({ data: { id: "stage1-sentinel-ledger", propertyId: "stage1-sentinel-property", unitId: "stage1-sentinel-unit", paymentId: "stage1-sentinel-payment", entryType: "PAYMENT", amountCents: -12345, effectiveDate: new Date("2020-01-01") } });
  await db.creator.create({ data: { id: "stage1-sentinel-creator", name: "Sentinel creator", slug: "sentinel-creator", startsAt: new Date("2020-01-01"), expiresAt: new Date("2100-01-01") } });
  await db.creatorReferral.create({ data: { id: "stage1-sentinel-creator-referral", creatorId: "stage1-sentinel-creator", propertyId: "stage1-sentinel-property", retainedPropertyId: "stage1-sentinel-property", businessNameSnapshot: "Protected synthetic sentinel" } });
  const expected: Record<string, string> = {};
  for (const [table, id] of Object.entries({ Property: "stage1-sentinel-property", Unit: "stage1-sentinel-unit", Payment: "stage1-sentinel-payment", LedgerEntry: "stage1-sentinel-ledger", Creator: "stage1-sentinel-creator", CreatorReferral: "stage1-sentinel-creator-referral" })) {
    // Identifiers come exclusively from this fixed test-owned allowlist.
    const [row] = await db.$queryRaw<{ json: string }[]>(Prisma.sql`SELECT row_to_json(t)::text AS json FROM ${Prisma.raw('"' + table + '"')} t WHERE "id" = ${id}`);
    expected[table] = row.json;
  }
  return expected;
}
