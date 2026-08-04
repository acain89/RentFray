import { prisma } from "../lib/prisma";

const repairs = [
  {
    propertyCode: "4530",
    expectedCurrent: "2026-06-03",
    replacement: "2026-06-01",
  },
  {
    propertyCode: "4770",
    expectedCurrent: "2026-06-17",
    replacement: "2026-06-01",
  },
  {
    propertyCode: "7785",
    expectedCurrent: "2026-08-03",
    replacement: "2026-08-01",
  },
] as const;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  for (const repair of repairs) {
    const property = await prisma.property.findUnique({
      where: {
        propertyCode: repair.propertyCode,
      },
      select: {
        id: true,
        name: true,
        propertyCode: true,
        rentFrayStartDate: true,
      },
    });

    if (!property) {
      throw new Error(
        `Property ${repair.propertyCode} was not found.`
      );
    }

    const current = property.rentFrayStartDate
      ? dateOnly(property.rentFrayStartDate)
      : null;

    if (current !== repair.expectedCurrent) {
      throw new Error(
        [
          `Property ${repair.propertyCode} was not changed.`,
          `Expected current date ${repair.expectedCurrent}.`,
          `Found ${current ?? "null"}.`,
        ].join(" ")
      );
    }

    const updated = await prisma.property.update({
      where: {
        id: property.id,
      },
      data: {
        rentFrayStartDate: new Date(
          `${repair.replacement}T00:00:00`
        ),
      },
      select: {
        name: true,
        propertyCode: true,
        rentFrayStartDate: true,
      },
    });

    console.log(
      `REPAIRED: ${updated.name} (${updated.propertyCode}) ` +
      `${current} -> ${dateOnly(updated.rentFrayStartDate!)}`
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error("Legacy start-date repair failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
