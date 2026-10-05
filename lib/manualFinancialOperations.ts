import type { Prisma } from "@prisma/client";
export class ManualOperationError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
export function normalizeOperationId(value: unknown): string {
  const id = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new ManualOperationError("A valid operation UUID is required.", 400);
  return id;
}
export function assertOperationPayload(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new ManualOperationError("Operation ID was already used with a different payload.");
}
export async function lockManualOperation(tx: Prisma.TransactionClient, kind: string, propertyId: string, operationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'operation:' + kind + ':' + propertyId + ':' + operationId}))`;
}
export async function lockManualTenancy(tx: Prisma.TransactionClient, propertyId: string, unitId: string, assignmentId: string | null, cycle: string) {
  const tenancy = propertyId + ':' + unitId + ':' + (assignmentId ?? 'none');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenancy}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenancy + ':' + cycle}))`;
}
export async function lockManualRows(tx: Prisma.TransactionClient, propertyId: string, unitId: string, assignmentId: string | null, tierIds: string[]) {
  await tx.$queryRaw`SELECT "id" FROM "Property" WHERE "id" = ${propertyId} FOR UPDATE NOWAIT`;
  if (assignmentId) await tx.$queryRaw`SELECT "id" FROM "TenantAssignment" WHERE "id" = ${assignmentId} AND "propertyId" = ${propertyId} AND "unitId" = ${unitId} FOR UPDATE NOWAIT`;
  await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${unitId} AND "propertyId" = ${propertyId} FOR UPDATE NOWAIT`;
  for (const tierId of [...new Set(tierIds)].sort()) {
    await tx.$queryRaw`SELECT "id" FROM "PropertyTier" WHERE "id" = ${tierId} AND "propertyId" = ${propertyId} FOR UPDATE NOWAIT`;
  }
}
function completion<T>(metadata: string | null, payload: unknown): T {
  try {
    const data = JSON.parse(metadata ?? "null");
    if (!data?.operation?.result) throw Error("Missing completion");
    assertOperationPayload(data.operation.payload, payload);
    return data.operation.result as T;
  } catch (error) {
    if (error instanceof ManualOperationError) throw error;
    throw new ManualOperationError("Existing operation cannot be safely replayed.");
  }
}
export async function replayManualPayment<T>(tx: Prisma.TransactionClient, propertyId: string, key: string, payload: unknown): Promise<T | null> {
  const entry = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: key }, select: { id: true, propertyId: true, paymentId: true } });
  if (!entry) return null;
  if (entry.propertyId !== propertyId || !entry.paymentId) throw new ManualOperationError("Invalid existing payment identity.");
  const audit = await tx.auditLog.findFirst({ where: { propertyId, action: "MANUAL_PAYMENT_POSTED", targetId: entry.id }, select: { metadataJson: true } });
  return completion<T>(audit?.metadataJson ?? null, payload);
}
export async function replayTierMove<T>(tx: Prisma.TransactionClient, propertyId: string, operationId: string, payload: unknown): Promise<T | null> {
  const audits = await tx.auditLog.findMany({ where: { propertyId, action: "TIER_MOVE_COMPLETED", metadataJson: { contains: operationId } }, select: { metadataJson: true } });
  if (audits.length === 0) return null;
  if (audits.length !== 1) throw new ManualOperationError("Ambiguous existing operation.");
  return completion<T>(audits[0].metadataJson, payload);
}
export function isManualRetryable(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string } };
  return e?.code === "P2034" || ["40001", "40P01"].includes(e?.meta?.code ?? e?.code ?? "");
}
export function isManualLockContention(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string } };
  return (e?.meta?.code ?? e?.code) === "55P03";
}
