import { PrismaClient, Prisma } from "@prisma/client";
import { readFile, realpath, lstat, open, unlink } from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";

export class OperationalSafetyError extends Error {
  constructor(readonly code: string) { super(code); }
}
function reject(code: string): never { throw new OperationalSafetyError(code); }
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export const disposableOperations = {
  "prisma-seed": { module: "prisma/seed.ts", codes: ["1234"] },
  "scale-seed": { module: "scripts/seed-scale-property.ts", codes: ["9200"] },
  "production-smoke": { module: "scripts/production-smoke-test.ts", codes: ["9998"] },
  "financial-regression": { module: "scripts/rentfray-financial-regression.ts", codes: ["9920"] },
  "cycle-rollover": { module: "scripts/cycle-rollover-test.ts", codes: ["9917"] },
  "rentfray-qa": { module: "scripts/rentfray-qa.ts", codes: ["9917"] },
  "qa-audit": { module: "scripts/qa/audit.ts", codes: ["9920"] },
  "qa-integration": { module: "scripts/qa/rentfray-integration-tests.ts", codes: ["9920"] },
} as const;
export type DisposableOperation = keyof typeof disposableOperations;
export function operationName(value: unknown): DisposableOperation {
  if (typeof value !== "string" || !Object.hasOwn(disposableOperations, value)) return reject("OPERATION_NOT_ALLOWED");
  // The runtime key check above validates this finite registry boundary.
  return value as DisposableOperation;
}
export type DisposableManifest = {
  version: 1; operation: DisposableOperation; root: string; nonce: string;
  databaseUrl: string; database: string; username: string; port: number; propertyCodes: string[];
};
export function parseManifest(value: unknown, operation: DisposableOperation): DisposableManifest {
  if (!isRecord(value) || value.version !== 1 || value.operation !== operation ||
      typeof value.root !== "string" || typeof value.nonce !== "string" || !/^[a-f0-9]{32}$/.test(value.nonce) ||
      typeof value.databaseUrl !== "string" || typeof value.database !== "string" || typeof value.username !== "string" ||
      typeof value.port !== "number" || !Number.isSafeInteger(value.port) || value.port < 55000 || value.port > 65535 ||
      !Array.isArray(value.propertyCodes) || !value.propertyCodes.every((code: unknown): code is string => typeof code === "string")) return reject("MANIFEST_INVALID");
  const codes = value.propertyCodes;
  const expected = disposableOperations[operation].codes;
  if (value.propertyCodes.length !== expected.length || expected.some(code => !codes.includes(code))) return reject("TARGET_SCOPE_INVALID");
  let url: URL;
  try { url = new URL(value.databaseUrl); } catch { return reject("DATABASE_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || Number(url.port) !== value.port || url.hash ||
      decodeURIComponent(url.username) !== value.username || decodeURIComponent(url.pathname.slice(1)) !== value.database ||
      value.database !== "rf_disposable_" + value.nonce || value.username !== "rf_disposable_" + value.nonce) return reject("DATABASE_TARGET_NOT_DISPOSABLE");
  if (new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length) reject("DATABASE_OVERRIDE_REJECTED");
  for (const [key, param] of url.searchParams) {
    if (key === "schema" && param === "public") continue;
    const limit = key === "connection_limit" ? 4 : key === "pool_timeout" ? 30 : key === "connect_timeout" ? 10 : 0;
    if (!limit || !/^[1-9][0-9]*$/.test(param) || Number(param) > limit) return reject("DATABASE_OVERRIDE_REJECTED");
  }
  return { version: 1, operation, root: value.root, nonce: value.nonce, databaseUrl: value.databaseUrl,
    database: value.database, username: value.username, port: value.port, propertyCodes: codes };
}
export type LocalEvidence = { tempRoot: string; manifestPath: string; realRoot: string; realData: string;
  regularManifest: boolean; pgVersion: string; pid: number; pidAlive: boolean; startedEpoch: number; port: number; pidDataDirectory: string };
export function validateLocalEvidence(manifest: DisposableManifest, evidence: LocalEvidence): void {
  const root = resolve(manifest.root), data = join(root, "data");
  if (dirname(root) !== resolve(evidence.tempRoot) || basename(root) !== "rentfray-disposable-" + manifest.nonce ||
      resolve(evidence.realRoot) !== root || resolve(evidence.realData) !== data || resolve(evidence.manifestPath) !== join(root, "manifest.json") ||
      !evidence.regularManifest || !/^(?:1[4-9]|[2-9][0-9])(?:\.[0-9]+)*$/.test(evidence.pgVersion.trim()) ||
      !Number.isSafeInteger(evidence.pid) || evidence.pid < 1 || !evidence.pidAlive ||
      !Number.isSafeInteger(evidence.startedEpoch) || evidence.startedEpoch < 1 || evidence.port !== manifest.port ||
      resolve(evidence.pidDataDirectory) !== data) reject("LOCAL_CLUSTER_NOT_VERIFIED");
}
export function validateServerIdentity(manifest: DisposableManifest, evidence: LocalEvidence, row: unknown): void {
  if (!isRecord(row) || row.database !== manifest.database || row.username !== manifest.username || row.address !== "127.0.0.1" ||
      row.port !== manifest.port || row.clusterName !== "rentfray-disposable-" + manifest.nonce ||
      typeof row.dataDirectory !== "string" || resolve(row.dataDirectory) !== resolve(evidence.realData) ||
      !(row.startedAt instanceof Date) || Math.floor(row.startedAt.getTime() / 1000) !== evidence.startedEpoch) reject("SERVER_IDENTITY_NOT_VERIFIED");
}
export async function verifyBeforeWork<T>(manifest: DisposableManifest, evidence: LocalEvidence,
  readIdentity: () => Promise<unknown>, work: () => Promise<T>): Promise<T> {
  validateLocalEvidence(manifest, evidence);
  validateServerIdentity(manifest, evidence, await readIdentity());
  return work();
}
function boundedValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 || isRecord(value) &&
    (typeof value.equals === "string" && value.equals.trim().length > 0 || Array.isArray(value.in) && value.in.length > 0 && value.in.every(item => typeof item === "string" && item.trim().length > 0));
}
export function boundedWhere(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (["id", "propertyId", "propertyCode", "unitId", "tenantAssignmentId", "managementUserId", "idempotencyKey", "operationKey"].some(key => boundedValue(value[key]))) return true;
  if (Array.isArray(value.AND) && value.AND.some(boundedWhere)) return true;
  return Array.isArray(value.OR) && value.OR.length > 0 && value.OR.every(boundedWhere);
}
function rawSql(args: unknown, depth = 0): string | null {
  if (depth > 2) return null;
  if (typeof args === "string") return args.length <= 65536 ? args : null;
  if (Array.isArray(args)) {
    const first: unknown = args[0];
    if (Array.isArray(first) && first.every((part: unknown) => typeof part === "string")) return first.join(" ? ");
    return rawSql(first, depth + 1);
  }
  if (isRecord(args)) {
    for (const key of ["query", "sql", "text"]) if (typeof args[key] === "string") return rawSql(args[key], depth + 1);
    if (Array.isArray(args.strings) && args.strings.every((part: unknown) => typeof part === "string")) return args.strings.join(" ? ");
  }
  return null;
}
export function assertMutationScope(action: string, args: unknown): void {
  if (action === "executeRawUnsafe" || action === "queryRawUnsafe") reject("UNSAFE_RAW_OPERATION_REJECTED");
  if (["delete", "deleteMany", "update", "updateMany", "upsert"].includes(action) && (!isRecord(args) || !boundedWhere(args.where))) reject("UNSCOPED_MUTATION_REJECTED");
  if (["executeRaw", "queryRaw", "executeRawUnsafe", "queryRawUnsafe"].includes(action)) {
    const query = rawSql(args);
    if (!query) reject("RAW_OPERATION_NOT_VERIFIED");
    if (!/^\s*SELECT\b/i.test(query) || /\b(?:pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_read_file|pg_write_file|lo_import|lo_export|lo_unlink|dblink_exec|set_config)\s*\(/i.test(query)) reject("RAW_OPERATION_NOT_VERIFIED");
    const sql = query.replace(/FOR\s+(?:NO\s+KEY\s+)?UPDATE(?:\s+NOWAIT|\s+SKIP\s+LOCKED)?/gi, "");
    if (/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|COPY|CALL|DO)\b/i.test(sql)) reject("RAW_MUTATION_REJECTED");
  }
}
type Permit = { operation: DisposableOperation; client: PrismaClient };
let permit: Permit | undefined;
export function disposableClient(expected: DisposableOperation | readonly DisposableOperation[]): PrismaClient {
  const allowed: readonly DisposableOperation[] = typeof expected === "string" ? [expected] : expected;
  if (!permit || !allowed.includes(permit.operation)) return reject("DISPOSABLE_CAPABILITY_REQUIRED");
  return permit.client;
}
export function currentDisposableOperation(): DisposableOperation {
  if (!permit) return reject("DISPOSABLE_CAPABILITY_REQUIRED");
  return permit.operation;
}
export function assertDisposableClient(expected: DisposableOperation | readonly DisposableOperation[], client: PrismaClient): void {
  if (client !== disposableClient(expected)) reject("UNVERIFIED_CLIENT_REJECTED");
}
export function requireOperationalReview(utility: string): void {
  if (!utility.trim()) reject("OPERATION_NAME_REQUIRED");
  reject("OPERATIONAL_REVIEW_REQUIRED");
}
export async function assertEmptySeedDatabase(client: PrismaClient): Promise<void> {
  assertDisposableClient("prisma-seed", client);
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate: unknown = Reflect.get(client, model.name.charAt(0).toLowerCase() + model.name.slice(1));
    if (!isRecord(delegate) || typeof delegate.count !== "function") reject("SEED_DATABASE_NOT_VERIFIED");
    const count: unknown = await Reflect.apply(delegate.count, delegate, []);
    if (count !== 0) reject("SEED_REQUIRES_EMPTY_DATABASE");
  }
}
export async function openDisposableUtility(operation: DisposableOperation, manifestPath: string | undefined, execute: boolean): Promise<{ close(): Promise<void> }> {
  if (permit) reject("DISPOSABLE_OPERATION_ALREADY_ACTIVE");
  if (!manifestPath) reject("DISPOSABLE_MANIFEST_REQUIRED");
  if (!execute) reject("DRY_RUN_NO_MUTATION_EXECUTED_REQUIRE_EXPLICIT_EXECUTE");
  let manifest: DisposableManifest, evidence: LocalEvidence;
  try {
    const raw: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest = parseManifest(raw, operation);
    const root = resolve(manifest.root), data = join(root, "data"), pid = (await readFile(join(data, "postmaster.pid"), "utf8")).split(/\r?\n/);
    const processId = Number(pid[0]); let alive = false;
    try { process.kill(processId, 0); alive = true; } catch { /* A missing/inaccessible process is not verified. */ }
    evidence = { tempRoot: await realpath(tmpdir()), manifestPath: await realpath(manifestPath), realRoot: await realpath(root), realData: await realpath(data),
      regularManifest: (await lstat(manifestPath)).isFile() && !(await lstat(manifestPath)).isSymbolicLink() && !(await lstat(root)).isSymbolicLink() && !(await lstat(data)).isSymbolicLink(),
      pgVersion: await readFile(join(data, "PG_VERSION"), "utf8"), pid: processId, pidAlive: alive, startedEpoch: Number(pid[2]), port: Number(pid[3]), pidDataDirectory: pid[1] };
    validateLocalEvidence(manifest, evidence);
  } catch (error: unknown) {
    if (error instanceof OperationalSafetyError) throw error;
    return reject("DISPOSABLE_EVIDENCE_UNAVAILABLE");
  }
  const lockPath = join(manifest.root, "operation.lock");
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); } catch { return reject("DISPOSABLE_OPERATION_ALREADY_LOCKED"); }
  const client = new PrismaClient({ datasources: { db: { url: manifest.databaseUrl } }, log: [] });
  try {
    await verifyBeforeWork(manifest, evidence, () => client.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const rows = await tx.$queryRaw<unknown[]>`SELECT current_database() AS database, current_user AS username,
        current_setting('data_directory') AS "dataDirectory", current_setting('cluster_name') AS "clusterName",
        host(inet_server_addr()) AS address, inet_server_port() AS port, pg_postmaster_start_time() AS "startedAt"`;
      if (rows.length !== 1) reject("SERVER_IDENTITY_NOT_VERIFIED");
      return rows[0];
    }), async () => undefined);
    client.$use(async (params, next) => { if (permit?.client !== client) reject("DISPOSABLE_CAPABILITY_EXPIRED"); const args: unknown = params.args; assertMutationScope(params.action, args); return next(params); });
    permit = { operation, client };
    process.env.DATABASE_URL = manifest.databaseUrl;
    const singleton = globalThis as typeof globalThis & { prisma?: PrismaClient };
    singleton.prisma = client;
    return { async close() {
      if (permit?.client === client) permit = undefined;
      if (singleton.prisma === client) delete singleton.prisma;
      try { await client.$disconnect(); } finally { try { await lock.close(); } finally { await unlink(lockPath); } }
    } };
  } catch (error: unknown) {
    await client.$disconnect(); await lock.close(); await unlink(lockPath);
    if (error instanceof OperationalSafetyError) throw error;
    return reject("DISPOSABLE_CONNECTION_NOT_VERIFIED");
  }
}
