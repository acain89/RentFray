import type { Prisma } from "@prisma/client";

export const UNIT_RETENTION_MESSAGE =
  "This unit has history and cannot be deleted. Keep it inactive to preserve its records.";
export const PROPERTY_RETENTION_MESSAGE =
  "This property has history or established service configuration and cannot be deleted. Preserve it and use normal lifecycle or deactivation controls.";

export class DestructiveRetentionError extends Error {}

type RetentionUnit = {
  id: string;
  portalActivated: boolean;
  portalFirstName: string | null;
  portalLastName: string | null;
  tenantPinHash: string | null;
  activatedAt: Date | null;
  activationSource: string | null;
};

// Caller owns the interactive transaction. Always lock Property before Unit.
export async function lockRetentionProperty(tx: Prisma.TransactionClient, propertyId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Property" WHERE "id" = ${propertyId} FOR UPDATE`;
}

export async function lockRetentionUnit(tx: Prisma.TransactionClient, propertyId: string, unitId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "propertyId" = ${propertyId} AND "id" = ${unitId} FOR UPDATE`;
}

// No date, status, amount or void filters: any surviving dependent row is evidence.
export async function assertPristineUnit(tx: Prisma.TransactionClient, unit: RetentionUnit) {
  if (unit.portalActivated || unit.portalFirstName !== null || unit.portalLastName !== null ||
      unit.tenantPinHash !== null || unit.activatedAt !== null || unit.activationSource !== null) {
    throw new DestructiveRetentionError(UNIT_RETENTION_MESSAGE);
  }
  const where = { unitId: unit.id };
  const evidence = await Promise.all([
    tx.tenantAssignment.findFirst({ where, select: { id: true } }),
    tx.ledgerEntry.findFirst({ where, select: { id: true } }),
    tx.payment.findFirst({ where, select: { id: true } }),
    tx.maintenanceRequest.findFirst({ where, select: { id: true } }),
    tx.unitNote.findFirst({ where, select: { id: true } }),
    tx.unitRecurringFee.findFirst({ where, select: { id: true } }),
    // Target/metadata IDs also catch legacy logs with missing or inconsistent scope.
    tx.auditLog.findFirst({ where: { OR: [
      { targetId: unit.id }, { metadataJson: { contains: unit.id } },
    ] }, select: { id: true } }),
  ]);
  if (evidence.some(Boolean)) throw new DestructiveRetentionError(UNIT_RETENTION_MESSAGE);
}

export async function assertPristineProperty(tx: Prisma.TransactionClient, propertyId: string) {
  // Lock mutable child state as well: a portal/login/connection update must not
  // race the post-lock eligibility read. New FK-backed children wait on Property.
  await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "propertyId" = ${propertyId} ORDER BY "id" FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "ManagementUser" WHERE "propertyId" = ${propertyId} ORDER BY "id" FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "MaintenanceUser" WHERE "propertyId" = ${propertyId} ORDER BY "id" FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "PropertySettings" WHERE "propertyId" = ${propertyId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "PaymentConnectionStatus" WHERE "propertyId" = ${propertyId} FOR UPDATE`;
  const property = await tx.property.findUnique({ where: { id: propertyId }, include: {
    units: true, settings: true, paymentStatus: true, managementUsers: true, maintenanceUsers: true,
  } });
  if (!property) return false;
  const connection = property.paymentStatus;
  if (!["SETUP", "TEST"].includes(property.status) || property.stripeAccountId !== null ||
      property.rentFrayStartDate !== null || property.setupCompleteAcknowledgedAt !== null ||
      property.settings?.onboardingComplete || property.settings?.setupComplete ||
      (connection && (connection.processorConnected || connection.bankConnected || connection.chargesEnabled ||
        connection.payoutsEnabled || connection.onboardingComplete || connection.requirementsDue ||
        connection.requirementsSummary !== null || connection.lastSyncedAt !== null || connection.readyForLive)) ||
      property.managementUsers.some(user => user.lastLoginAt !== null || user.emailVerifiedAt !== null) ||
      property.maintenanceUsers.some(user => user.lastLoginAt !== null)) {
    throw new DestructiveRetentionError(PROPERTY_RETENTION_MESSAGE);
  }
  const where = { propertyId };
  const evidence = await Promise.all([
    tx.ledgerEntry.findFirst({ where, select: { id: true } }),
    tx.payment.findFirst({ where, select: { id: true } }),
    tx.tenantAssignment.findFirst({ where, select: { id: true } }),
    tx.maintenanceRequest.findFirst({ where, select: { id: true } }),
    tx.unitNote.findFirst({ where, select: { id: true } }),
    tx.unitRecurringFee.findFirst({ where, select: { id: true } }),
    tx.auditLog.findFirst({ where: { OR: [
      { propertyId }, { targetId: propertyId }, { metadataJson: { contains: propertyId } },
    ] }, select: { id: true } }),
  ]);
  if (evidence.some(Boolean)) throw new DestructiveRetentionError(PROPERTY_RETENTION_MESSAGE);
  for (const unit of property.units) {
    try { await assertPristineUnit(tx, unit); }
    catch (error) {
      if (error instanceof DestructiveRetentionError) throw new DestructiveRetentionError(PROPERTY_RETENTION_MESSAGE);
      throw error;
    }
  }
  return true;
}
