import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const accounts = await prisma.property.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });

  console.table(
    accounts.map((account) => ({
      name: account.name,
      createdAt: account.createdAt.toLocaleString(),
      id: account.id,
    })),
  );

  console.log(`\nTotal property accounts shown: ${accounts.length}`);
}

main()
  .catch((error: unknown) => {
    console.error("Unable to retrieve accounts:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });