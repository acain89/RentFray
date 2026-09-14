import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const property = await prisma.property.findFirst({
    where: {
      propertyCode: "8506",
    },
    select: {
      id: true,
      name: true,
      propertyCode: true,
    },
  });

  console.log(property);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
