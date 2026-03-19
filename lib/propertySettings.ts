import { prisma } from "@/lib/prisma";

export async function getPropertySettings(propertyId: string) {
  const settings = await prisma.propertySettings.findUnique({
    where: { propertyId },
  });

  if (!settings) {
    return {
      billingDay: 1,
      gracePeriodDays: 5,
      lateFeeType: "FLAT",
      lateFeeValue: 50,
    };
  }

  return settings;
}

export async function upsertPropertySettings(
  propertyId: string,
  data: {
    billingDay: number;
    gracePeriodDays: number;
    lateFeeType: "FLAT" | "PERCENT";
    lateFeeValue: number;
  }
) {
  return prisma.propertySettings.upsert({
    where: { propertyId },
    create: {
      propertyId,
      ...data,
    },
    update: {
      ...data,
    },
  });
}