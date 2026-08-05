import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TableRow = {
  table_schema: string;
  table_name: string;
};

async function main(): Promise<void> {
  const database = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database()
  `;

  const tables = await prisma.$queryRaw<TableRow[]>`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  console.log("DATABASE:", database[0]?.current_database ?? "unknown");
  console.table(tables);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
