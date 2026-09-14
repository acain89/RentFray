import { PrismaClient } from "@prisma/client";
import {
  getBusinessDate,
  getDueBillingCyclesThrough,
} from "../lib/rentDates";

const prisma = new PrismaClient();

const PROPERTY_ID = "cmsryk9t20003wpgbj1agr0xy";

async function main() {
  const now = new Date();

  const property = await prisma.property.findUnique({
    where: { id: PROPERTY_ID },
    include: {
      settings: true,
      tiers: true,
      units: {
        where: { isActive: true },
        include: {
          tenantAssignments: {
            where: {
              isCurrent: true,
              moveOutDate: null,
            },
          },
          recurringFeeItems: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  if (!property.rentFrayStartDate) {
    throw new Error("Property has no RentFray start date.");
  }

  console.log("====================================================");
  console.log(" RENTFRAY BILLING CYCLE VERIFICATION — READ ONLY");
  console.log("====================================================");
  console.log("Property:", property.name);
  console.log("Business today:", getBusinessDate(now));
  console.log("Hard start:", property.rentFrayStartDate);
  console.log("");

  for (const unit of property.units) {
    const assignment = unit.tenantAssignments[0];

    console.log("----------------------------------------------------");
    console.log(`UNIT ${unit.unitNumber}`);
    console.log("Current tenant:", assignment ? "YES" : "NO");

    if (!assignment) {
      console.log("SKIP — no current tenant.");
      continue;
    }

    const tier = property.tiers.find(
  (candidate) => candidate.id === unit.tierId
);

    if (!tier) {
      console.log("SKIP — tier not found.");
      continue;
    }

    const cycles = getDueBillingCyclesThrough({
      rentFrayStartDate: property.rentFrayStartDate,
      dueDay: tier.rentDueDay,
      now,
    });

    console.log("Tier:", tier.name);
    console.log("Due day:", tier.rentDueDay);
    console.log("Due cycles:");

    for (const cycle of cycles) {
      console.log(`  ${cycle.billingCycle} — due ${cycle.dueDate}`);
    }
  }

  console.log("");
  console.log("READ ONLY — no database changes made.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });