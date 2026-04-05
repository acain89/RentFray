import { prisma } from "@/lib/prisma";

export async function getInactiveUnitCount(propertyId: string): Promise<number> {
  return prisma.unit.count({
    where: {
      propertyId,
      isActive: false,
    },
  });
}

export async function getConfiguredUnitCount(propertyId: string): Promise<number> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      unitCount: true,
    },
  });

  return property?.unitCount ?? 0;
}

export async function getEffectiveUnitCount(propertyId: string): Promise<number> {
  const [configuredUnitCount, inactiveUnitCount] = await Promise.all([
    getConfiguredUnitCount(propertyId),
    getInactiveUnitCount(propertyId),
  ]);

  return Math.max(0, configuredUnitCount - inactiveUnitCount);
}

export async function getOccupiedUnitCount(propertyId: string): Promise<number> {
  return prisma.tenantAssignment.count({
    where: {
      propertyId,
      isCurrent: true,
      moveOutDate: null,
    },
  });
}

export async function getStoredUnitCountForEffectiveTarget(
  propertyId: string,
  desiredEffectiveUnitCount: number
): Promise<number> {
  const inactiveUnitCount = await getInactiveUnitCount(propertyId);
  return desiredEffectiveUnitCount + inactiveUnitCount;
}

export async function canActivateUnit(propertyId: string): Promise<boolean> {
  const [effectiveUnitCount, occupiedUnitCount] = await Promise.all([
    getEffectiveUnitCount(propertyId),
    getOccupiedUnitCount(propertyId),
  ]);

  return occupiedUnitCount < effectiveUnitCount;
}

export async function validateUnitCapacityUpdate(
  propertyId: string,
  nextEffectiveUnitCount: number
): Promise<{ valid: boolean; error?: string }> {
  if (!Number.isInteger(nextEffectiveUnitCount) || nextEffectiveUnitCount < 1) {
    return { valid: false, error: "Unit count must be a positive integer." };
  }

  const occupiedUnitCount = await getOccupiedUnitCount(propertyId);

  if (nextEffectiveUnitCount < occupiedUnitCount) {
    return {
      valid: false,
      error: "Total units cannot be lower than occupied unit count.",
    };
  }

  return { valid: true };
}

export async function getCapacitySnapshot(propertyId: string): Promise<{
  configuredUnitCount: number;
  inactiveUnitCount: number;
  effectiveUnitCount: number;
  occupiedUnitCount: number;
}> {
  const [configuredUnitCount, inactiveUnitCount, occupiedUnitCount] =
    await Promise.all([
      getConfiguredUnitCount(propertyId),
      getInactiveUnitCount(propertyId),
      getOccupiedUnitCount(propertyId),
    ]);

  return {
    configuredUnitCount,
    inactiveUnitCount,
    effectiveUnitCount: Math.max(0, configuredUnitCount - inactiveUnitCount),
    occupiedUnitCount,
  };
}