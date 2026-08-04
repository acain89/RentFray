import { prisma } from "../lib/prisma";
import {
  getBusinessDate,
  resolveEffectiveBillingSettings,
} from "../lib/rentDates";

async function main(): Promise<void> {
  const property = await prisma.property.findUnique({
    where: { propertyCode: "9920" },
    include: {
      settings: true,
      units: {
        take: 1,
        include: {
          tier: true,
        },
      },
    },
  });

  if (!property) {
    throw new Error("QA property 9920 was not found.");
  }

  const unit = property.units[0];

  if (!unit) {
    throw new Error("QA property has no units.");
  }

  const effective = resolveEffectiveBillingSettings({
    tier: unit.tier,
    propertySettings: property.settings,
  });

  const start = property.rentFrayStartDate;

  console.log({
    rawRentFrayStartDate: start,
    isoRentFrayStartDate: start?.toISOString() ?? null,
    localParts: start
      ? {
          year: start.getFullYear(),
          month: start.getMonth() + 1,
          day: start.getDate(),
        }
      : null,
    utcParts: start
      ? {
          year: start.getUTCFullYear(),
          month: start.getUTCMonth() + 1,
          day: start.getUTCDate(),
        }
      : null,
    effectiveDueDay: effective.dueDay,
    tierDueDay: unit.tier?.rentDueDay ?? null,
    settingsDueDay: property.settings?.rentDueDay ?? null,
    businessDate: getBusinessDate(
      new Date("2026-01-17T12:00:00")
    ),
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
