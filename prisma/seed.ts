import { PrismaClient } from "@prisma/client";
import { hashPin } from "@/lib/pin";

const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.create({
    data: {
      name: "Demo Property",
      code: "4829",
      timezone: "America/Chicago",
    },
  });

  await prisma.propertySettings.create({
    data: {
      propertyId: property.id,
      billingDay: 1,
      gracePeriodDays: 5,
      lateFeeType: "FLAT",
      lateFeeValue: 50,
      convenienceFeePct: 0,
    },
  });

  const unit = await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitNumber: "101",
      tier: "Standard",
      marketRent: 1200,
      occupancyStatus: "OCCUPIED",
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      propertyId: property.id,
      name: "John Doe",
      email: "john@test.com",
      phone: "123",
      pinHash: hashPin("1234"),
      status: "ACTIVE",
    },
  });

  await prisma.unitAssignment.create({
    data: {
      unitId: unit.id,
      tenantId: tenant.id,
      moveIn: new Date(),
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });