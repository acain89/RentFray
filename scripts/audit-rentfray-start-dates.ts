import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

type AuditedProperty = Prisma.PropertyGetPayload<{
  include: {
    settings: true;
    tiers: {
      select: {
        rentDueDay: true;
      };
    };
  };
}>;

type StartDateMismatch = {
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  rentFrayStartDate: string;
  startDay: number;
  dueDay: number;
};

async function main(): Promise<void> {
  const properties = await prisma.property.findMany({
    where: {
      rentFrayStartDate: {
        not: null,
      },
    },
    include: {
      settings: true,
      tiers: {
        where: {
          isActive: true,
        },
        orderBy: [
          { sortOrder: "asc" },
          { id: "asc" },
        ],
        select: {
          rentDueDay: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const mismatches = properties
    .map((property: AuditedProperty) => {
      const startDate = property.rentFrayStartDate;

      if (!startDate) {
        return null;
      }

      const dueDay =
        property.settings?.rentDueDay ??
        property.tiers[0]?.rentDueDay ??
        null;

      const startDay = startDate.getUTCDate();

      if (!dueDay || startDay === dueDay) {
        return null;
      }

      return {
        propertyId: property.id,
        propertyCode: property.propertyCode,
        propertyName: property.name,
        rentFrayStartDate: startDate.toISOString().slice(0, 10),
        startDay,
        dueDay,
      };
    })
    .filter(
  (row: StartDateMismatch | null): row is StartDateMismatch =>
    row !== null
);

  if (mismatches.length === 0) {
    console.log("PASS: No legacy RentFray Start Date mismatches found.");
    return;
  }

  console.log("LEGACY START-DATE MISMATCHES:");
  console.table(mismatches);
  process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
