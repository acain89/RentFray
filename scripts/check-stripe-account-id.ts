import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findUnique({
    where: { id: "cmu27xkso00097vd5skhot678" },
    select: {
      name: true,
      id: true,
      stripeAccountId: true,
    },
  });

  console.log(property);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
