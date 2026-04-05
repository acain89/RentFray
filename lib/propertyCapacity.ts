import { prisma } from "@/lib/prisma";

/**
 * Active unit = isActive = true
 * This is the ONLY authority for capacity usage
 */
export async function getActiveUnitCount(propertyId: string): Promise<number> {
  return prisma.unit.count({
    where: {
      propertyId,
      isActive: true,
    },
  });
}

/**
 * Determines if a new activation is allowed
 */
export async function canActivateUnit(propertyId: string): Promise<boolean> {
 const property = await prisma.property.findUnique({
  where: { id: propertyId },
  select: {
    unitCount: true,
  },
});

if (!property) return false;

const maxUnits = property.unitCount;

  const activeUnits = await getActiveUnitCount(propertyId);

  return activeUnits < maxUnits;
}

/**
 * Validate manager update to capacity
 */
export async function validateUnitCapacityUpdate(
  propertyId: string,
  nextUnitCount: number
): Promise<{ valid: boolean; error?: string }> {
  if (!Number.isInteger(nextUnitCount) || nextUnitCount < 1) {
    return { valid: false, error: "Unit count must be a positive integer." };
  }

  const activeUnits = await getActiveUnitCount(propertyId);

  if (nextUnitCount < activeUnits) {
    return {
      valid: false,
      error: "Total units cannot be lower than active unit count.",
    };
  }

  return { valid: true };
}