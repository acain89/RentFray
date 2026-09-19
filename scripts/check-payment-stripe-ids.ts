import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const payment = await prisma.payment.findFirst({
    where: {
      propertyId: "cmu27xkso00097vd5skhot678",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      status: true,
      amountCents: true,
      stripeSessionId: true,
      stripePaymentIntentId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(payment);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
