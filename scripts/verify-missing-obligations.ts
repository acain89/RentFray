import { PrismaClient } from "@prisma/client";
import {
  getBusinessDate,
  getDueBillingCyclesThrough,
} from "../lib/rentDates";

const prisma = new PrismaClient();

const PROPERTY_ID = "cmsryk9t20003wpgbj1agr0xy";

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

async function main() {
  const now = new Date();

  const property = await prisma.property.findUnique({
    where: { id: PROPERTY_ID },
    include: {
      settings: true,
      tiers: {
        include: {
          charges: true,
        },
      },
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
  console.log(" RENTFRAY MISSING OBLIGATIONS — READ ONLY");
  console.log("====================================================");
  console.log("Property:", property.name);
  console.log("Business today:", getBusinessDate(now));
  console.log("");

  for (const unit of property.units) {
    const assignment = unit.tenantAssignments[0];

    console.log("----------------------------------------------------");
    console.log(`UNIT ${unit.unitNumber}`);

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

    for (const cycle of cycles) {
      const dueDate = parseDateOnly(cycle.dueDate);

      console.log("");
      console.log(`${cycle.billingCycle} — due ${cycle.dueDate}`);

      const existingRent = await prisma.ledgerEntry.findFirst({
        where: {
          propertyId: property.id,
          unitId: unit.id,
          tenantAssignmentId: assignment.id,
          billingCycle: cycle.billingCycle,
          entryType: "CHARGE",
          chargeType: "RENT",
          voidedAt: null,
        },
        select: {
          id: true,
          amountCents: true,
          memo: true,
        },
      });

      if (existingRent) {
        console.log(
          `  RENT: EXISTS — $${(
            existingRent.amountCents / 100
          ).toFixed(2)}`
        );
      } else {
        console.log(
          `  RENT: MISSING — would create $${(
            tier.baseRentCents / 100
          ).toFixed(2)}`
        );
      }

      for (const fee of unit.recurringFeeItems) {
        /*
         * UnitRecurringFee has no explicit effectiveDate.
         * Do not back-bill it to a cycle whose due date predates
         * the fee's creation.
         */
        if (dueDate < getBusinessDate(fee.createdAt)) {
          console.log(
            `  UNIT FEE "${fee.label}": NOT YET ELIGIBLE`
          );
          continue;
        }

        const existingFee = await prisma.ledgerEntry.findFirst({
          where: {
            propertyId: property.id,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            billingCycle: cycle.billingCycle,
            entryType: "RECURRING_CHARGE",
            memo: fee.label,
            voidedAt: null,
          },
          select: {
            id: true,
            amountCents: true,
          },
        });

        if (existingFee) {
          console.log(
            `  UNIT FEE "${fee.label}": EXISTS — $${(
              existingFee.amountCents / 100
            ).toFixed(2)}`
          );
        } else {
          console.log(
            `  UNIT FEE "${fee.label}": MISSING — would create $${(
              fee.amountCents / 100
            ).toFixed(2)}`
          );
        }
      }

      for (const charge of tier.charges) {
        if (!charge.isActive) {
          continue;
        }

        if (dueDate < getBusinessDate(charge.effectiveDate)) {
          console.log(
            `  TIER FEE "${charge.label}": NOT YET ELIGIBLE`
          );
          continue;
        }

        const existingCharge = await prisma.ledgerEntry.findFirst({
          where: {
            propertyId: property.id,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            billingCycle: cycle.billingCycle,
            entryType: "RECURRING_CHARGE",
            memo: charge.label,
            voidedAt: null,
          },
          select: {
            id: true,
            amountCents: true,
          },
        });

        if (existingCharge) {
          console.log(
            `  TIER FEE "${charge.label}": EXISTS — $${(
              existingCharge.amountCents / 100
            ).toFixed(2)}`
          );
        } else {
          console.log(
            `  TIER FEE "${charge.label}": MISSING — would create $${(
              charge.amountCents / 100
            ).toFixed(2)}`
          );
        }
      }
    }
  }

  console.log("");
  console.log("====================================================");
  console.log("READ ONLY — no database changes made.");
  console.log("====================================================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });