import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { isRecord, OperationalSafetyError } from "./operational-safety";

function reject(code: string): never { throw new OperationalSafetyError(code); }
export type CreatorMaintenancePlan = { operation: "create-creator"; databaseUrl: string; name: string; slug: string;
  expected: { database: string; username: string; address: string; port: number; systemIdentifier: string; dataDirectory: string } };
export function parseCreatorPlan(input: unknown): CreatorMaintenancePlan {
  if (!isRecord(input) || input.operation !== "create-creator" || typeof input.databaseUrl !== "string" ||
      typeof input.name !== "string" || !input.name.trim() || input.name !== input.name.trim() || input.name.length > 200 ||
      typeof input.slug !== "string" || !/^[a-z][a-z0-9-]{1,47}$/.test(input.slug) || !isRecord(input.expected)) reject("MAINTENANCE_PLAN_INVALID");
  const e = input.expected;
  if (typeof e.database !== "string" || !e.database || typeof e.username !== "string" || !e.username ||
      typeof e.address !== "string" || !e.address || typeof e.port !== "number" || !Number.isSafeInteger(e.port) || e.port < 1 || e.port > 65535 ||
      typeof e.systemIdentifier !== "string" || !/^[0-9]{10,30}$/.test(e.systemIdentifier) || typeof e.dataDirectory !== "string" || !e.dataDirectory) reject("MAINTENANCE_IDENTITY_INCOMPLETE");
  let url: URL; try { url = new URL(input.databaseUrl); } catch { return reject("MAINTENANCE_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hash ||
      decodeURIComponent(url.pathname.slice(1)) !== e.database || decodeURIComponent(url.username) !== e.username ||
      url.searchParams.get("sslmode") !== "require" || url.searchParams.get("sslaccept") !== "strict") reject("MAINTENANCE_TLS_OR_TARGET_INVALID");
  if (new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length) reject("MAINTENANCE_OVERRIDE_REJECTED");
  for (const [key, value] of url.searchParams) {
    if (key === "sslmode" || key === "sslaccept" || key === "sslcert" && value || key === "schema" && value === "public") continue;
    const limit = key === "connection_limit" ? 4 : key === "pool_timeout" ? 30 : key === "connect_timeout" ? 10 : 0;
    if (!limit || !/^[1-9][0-9]*$/.test(value) || Number(value) > limit) reject("MAINTENANCE_OVERRIDE_REJECTED");
  }
  return { operation: "create-creator", databaseUrl: input.databaseUrl, name: input.name, slug: input.slug,
    expected: { database: e.database, username: e.username, address: e.address, port: e.port, systemIdentifier: e.systemIdentifier, dataDirectory: e.dataDirectory } };
}
export function verifyMaintenanceIdentity(plan: CreatorMaintenancePlan, actual: unknown): void {
  if (!isRecord(actual) || Object.entries(plan.expected).some(([key, value]) => actual[key] !== value)) reject("MAINTENANCE_SERVER_IDENTITY_MISMATCH");
}
export function assertCreatorMutation(plan: CreatorMaintenancePlan, model: string | undefined, action: string, args: unknown): void {
  if (model !== "Creator" || action !== "create" || !isRecord(args) || !isRecord(args.data) || args.data.slug !== plan.slug || args.data.name !== plan.name ||
      Object.keys(args.data).some(key => !["name", "slug", "startsAt", "expiresAt", "createdAt"].includes(key))) reject("MAINTENANCE_MUTATION_OUT_OF_SCOPE");
}
let verifiedClient: PrismaClient | undefined;
export function maintenanceClient(operation: "create-creator"): PrismaClient {
  if (operation !== "create-creator" || !verifiedClient) return reject("MAINTENANCE_CAPABILITY_REQUIRED");
  return verifiedClient;
}
export async function openCreatorMaintenance(path: string | undefined, execute: boolean): Promise<{ client: PrismaClient; close(): Promise<void> }> {
  if (verifiedClient) reject("MAINTENANCE_OPERATION_ALREADY_ACTIVE");
  if (!path) reject("MAINTENANCE_PLAN_REQUIRED");
  if (!execute) reject("MAINTENANCE_DRY_RUN_NO_MUTATION_EXECUTED");
  let plan: CreatorMaintenancePlan;
  try { const raw: unknown = JSON.parse(await readFile(path, "utf8")); plan = parseCreatorPlan(raw); }
  catch (error: unknown) { if (error instanceof OperationalSafetyError) throw error; return reject("MAINTENANCE_PLAN_UNAVAILABLE"); }
  const client = new PrismaClient({ datasources: { db: { url: plan.databaseUrl } }, log: [] });
  try {
    const rows = await client.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return tx.$queryRaw<unknown[]>`SELECT current_database() AS database, current_user AS username,
        host(inet_server_addr()) AS address, inet_server_port() AS port, current_setting('data_directory') AS "dataDirectory",
        (pg_control_system()).system_identifier::text AS "systemIdentifier"`;
    });
    if (rows.length !== 1) reject("MAINTENANCE_SERVER_IDENTITY_MISMATCH");
    verifyMaintenanceIdentity(plan, rows[0]);
    let attempted = false;
    client.$use(async (params, next) => {
      if (verifiedClient !== client) reject("MAINTENANCE_CAPABILITY_EXPIRED");
      if (["findUnique", "findFirst", "findMany", "count", "aggregate", "groupBy"].includes(params.action)) return next(params);
      const args: unknown = params.args; assertCreatorMutation(plan, params.model, params.action, args);
      if (attempted) reject("MAINTENANCE_SINGLE_OPERATION_ONLY");
      attempted = true; return next(params);
    });
    verifiedClient = client;
    process.argv = [process.execPath, "create-creator", "--name", plan.name, "--slug", plan.slug];
    return { client, async close() { verifiedClient = undefined; await client.$disconnect(); } };
  } catch (error: unknown) {
    await client.$disconnect(); if (error instanceof OperationalSafetyError) throw error;
    return reject("MAINTENANCE_IDENTITY_NOT_VERIFIED");
  }
}
