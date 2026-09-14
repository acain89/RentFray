import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const propertyIds = [
  "cmttcv3y5000l4ipipmjxd8ej", // Henderson Village
  "cmto163at003a107t0ztyqbzj", // Palos Hills
  "cmti1igu60016107t68dq01bs", // Redwood Ridge
  "cmthx4lxv0001107tbz2nqvkw", // Rosemont Berkeley lake
];

async function main() {
  const properties = await prisma.property.findMany({
    where: {
      id: { in: propertyIds },
    },
    select: {
      id: true,
      name: true,
      propertyCode: true,
      status: true,
      unitCount: true,
      setupCompleteAcknowledgedAt: true,

      tiers: {
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          name: true,
          baseRentCents: true,
          unitCount: true,
          activeUnitCount: true,
          billingFrequency: true,
          rentDueDay: true,
          gracePeriodDays: true,
          lateFeeType: true,
          lateFeeInitialCents: true,
          lateFeeDailyCents: true,
          maxLateFeeDays: true,
          processingFeeCents: true,
          isActive: true,

          charges: {
            where: {
              isActive: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
            select: {
              label: true,
              amountCents: true,
              effectiveDate: true,
            },
          },
        },
      },

      units: {
        orderBy: {
          unitNumber: "asc",
        },
        select: {
          id: true,
          unitNumber: true,
          unitType: true,
          baseRentCents: true,
          tierId: true,
          isActive: true,
          portalActivated: true,
        },
      },
    },
  });

  console.log("");
  console.log("============================================================");
  console.log("RENTFRAY CUSTOMER SETUP AUDIT");
  console.log("============================================================");

  for (const property of properties) {
    console.log("");
    console.log("------------------------------------------------------------");
    console.log("PROPERTY: " + property.name);
    console.log("ID: " + property.id);
    console.log("CODE: " + property.propertyCode);
    console.log("STATUS: " + property.status);
    console.log("PROPERTY UNIT COUNT: " + property.unitCount);
    console.log(
      "SETUP ACKNOWLEDGED: " +
        (property.setupCompleteAcknowledgedAt
          ? property.setupCompleteAcknowledgedAt.toISOString()
          : "NO")
    );

    console.log("");
    console.log("TIERS: " + property.tiers.length);

    if (property.tiers.length === 0) {
      console.log("  NO RENT TIERS CREATED.");
    } else {
      for (const tier of property.tiers) {
        console.log("");
        console.log("  TIER: " + tier.name);
        console.log("  Active: " + (tier.isActive ? "YES" : "NO"));
        console.log(
          "  Base Rent: $" + (tier.baseRentCents / 100).toFixed(2)
        );
        console.log("  Billing: " + tier.billingFrequency);
        console.log("  Due Day: " + tier.rentDueDay);
        console.log("  Grace Period: " + tier.gracePeriodDays + " day(s)");
        console.log("  Late Fee Type: " + tier.lateFeeType);
        console.log(
          "  Initial Late Fee: $" +
            (tier.lateFeeInitialCents / 100).toFixed(2)
        );
        console.log(
          "  Daily Late Fee: $" +
            (tier.lateFeeDailyCents / 100).toFixed(2)
        );
        console.log("  Max Late Fee Days: " + tier.maxLateFeeDays);
        console.log(
          "  Processing Fee: $" +
            (tier.processingFeeCents / 100).toFixed(2)
        );
        console.log("  Tier Unit Count: " + tier.unitCount);
        console.log("  Active Tier Units: " + tier.activeUnitCount);

        console.log("  ADDITIONAL CHARGES: " + tier.charges.length);

        if (tier.charges.length > 0) {
          for (const charge of tier.charges) {
            console.log(
              "    - " +
                charge.label +
                ": $" +
                (charge.amountCents / 100).toFixed(2)
            );
          }
        }
      }
    }

    console.log("");
    console.log("UNITS: " + property.units.length);

    if (property.units.length === 0) {
      console.log("  NO UNITS CREATED.");
    } else {
      for (const unit of property.units) {
        const tier = property.tiers.find(function (t) {
          return t.id === unit.tierId;
        });

        console.log(
          "  Unit " +
            unit.unitNumber +
            " | " +
            (unit.unitType || "No type") +
            " | Rent: $" +
            (unit.baseRentCents != null
              ? (unit.baseRentCents / 100).toFixed(2)
              : "0.00") +
            " | Tier: " +
            (tier ? tier.name : "NOT ASSIGNED") +
            " | Active: " +
            (unit.isActive ? "YES" : "NO") +
            " | Portal: " +
            (unit.portalActivated ? "YES" : "NO")
        );
      }
    }

    const activeUnits = property.units.filter(function (u) {
      return u.isActive;
    });

    const assignedUnits = property.units.filter(function (u) {
      return u.tierId != null;
    });

    const unassignedUnits = property.units.filter(function (u) {
      return u.tierId == null;
    });

    console.log("");
    console.log("SETUP ASSESSMENT:");

    if (property.tiers.length === 0 && property.units.length === 0) {
      console.log("  RESULT: STRIPE CONNECTED, BUT PROPERTY SETUP NOT STARTED.");
    } else if (property.tiers.length === 0) {
      console.log("  RESULT: UNITS EXIST, BUT NO RENT TIERS CREATED.");
    } else if (property.units.length === 0) {
      console.log("  RESULT: RENT TIERS EXIST, BUT NO UNITS CREATED.");
    } else if (unassignedUnits.length > 0) {
      console.log(
        "  RESULT: TIERS AND UNITS EXIST, BUT " +
          unassignedUnits.length +
          " UNIT(S) ARE NOT ASSIGNED TO A TIER."
      );
    } else {
      console.log("  RESULT: TIERS AND UNITS ARE SET UP.");
    }

    console.log("  Total units: " + property.units.length);
    console.log("  Active units: " + activeUnits.length);
    console.log("  Units assigned to tier: " + assignedUnits.length);
    console.log("  Units without tier: " + unassignedUnits.length);
  }

  console.log("");
  console.log("============================================================");
  console.log("END AUDIT");
  console.log("============================================================");
  console.log("");
}

main()
  .catch(function (error) {
    console.error(error);
    process.exit(1);
  })
  .finally(async function () {
    await prisma.$disconnect();
  });
