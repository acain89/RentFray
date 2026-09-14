import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const propertyId = "cmsryk9t20003wpgbj1agr0xy";

  const charges = await prisma.propertyTierCharge.findMany({
    where: {
      propertyId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      label: true,
      amountCents: true,
      effectiveDate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      tier: {
        select: {
          name: true,
        },
      },
    },
  });

  const ledger = await prisma.ledgerEntry.findMany({
    where: {
      propertyId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      unit: {
        select: {
          unitNumber: true,
        },
      },
      billingCycle: true,
      entryType: true,
      chargeType: true,
      amountCents: true,
      effectiveDate: true,
      memo: true,
      voidedAt: true,
      createdAt: true,
    },
  });

  console.log("\nTIER RECURRING CHARGES");
  console.log("====================================================");
  console.dir(charges, { depth: null });

  console.log("\nLEDGER ENTRIES");
  console.log("====================================================");
  console.dir(ledger, { depth: null });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
