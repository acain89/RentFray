import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const property = await prisma.property.findUnique({
    where: {
      id: "cmtx9x93j003e4ipij4zvou9b",
    },
    select: {
      name: true,
      unitCount: true,
      tiers: {
        select: {
          id: true,
          name: true,
          unitCount: true,
          baseRentCents: true,
          isActive: true,
        },
      },
      units: {
        select: {
          id: true,
          unitNumber: true,
          tierId: true,
          baseRentCents: true,
          isActive: true,
          portalActivated: true,
          tier: {
            select: {
              name: true,
              baseRentCents: true,
              unitCount: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  console.dir(property, { depth: null });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
