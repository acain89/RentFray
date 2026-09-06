import { PaymentStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function yesNo(value: boolean): string {
  return value ? "YES" : "NO";
}

function formatDate(value: Date | null | undefined): string {
  return value ? value.toISOString() : "NOT SET";
}

function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return "$0.00";
  }

  return `$${(cents / 100).toFixed(2)}`;
}

async function main(): Promise<void> {
  const searchName = "Rosemont Berkeley Lake";

  const property = await prisma.property.findFirst({
    where: {
      name: {
        contains: searchName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      propertyCode: true,
      status: true,
      propertyType: true,
      unitCount: true,
      createdAt: true,
      updatedAt: true,

      // Locked RentFray billing-calendar start date.
      rentFrayStartDate: true,

      // Indicates whether they dismissed/acknowledged final setup completion.
      setupCompleteAcknowledgedAt: true,

      // Stripe account existence.
      stripeAccountId: true,

      settings: {
        select: {
          rentDueDay: true,
          gracePeriodDays: true,
          lateFeeEnabled: true,
          lateFeeFlatCents: true,
          lateFeePercentBps: true,
          onboardingComplete: true,
          setupComplete: true,
          updatedAt: true,
        },
      },

      paymentStatus: {
        select: {
          processorConnected: true,
          bankConnected: true,
          chargesEnabled: true,
          payoutsEnabled: true,
          onboardingComplete: true,
          requirementsDue: true,
          requirementsSummary: true,
          readyForLive: true,
          lastSyncedAt: true,
          updatedAt: true,
        },
      },


      managementUsers: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          email: true,
          role: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      },


      _count: {
        select: {
          managementUsers: true,
          tiers: true,
          units: true,
          tenantAssignments: true,
          recurringFees: true,
          payments: true,
        },
      },

      tiers: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          name: true,
          baseRentCents: true,
          unitCount: true,
          activeUnitCount: true,
          rentDueDay: true,
          gracePeriodDays: true,
          lateFeeType: true,
          lateFeeInitialCents: true,
          lateFeeDailyCents: true,
          maxLateFeeDays: true,
          processingFeeCents: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },

      units: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          unitNumber: true,
          baseRentCents: true,
          portalActivated: true,
          createdAt: true,
          updatedAt: true,
        },
      },

      tenantAssignments: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          unitId: true,
          isCurrent: true,
          moveInDate: true,
          createdAt: true,
          updatedAt: true,
          unit: {
            select: {
              unitNumber: true,
            },
          },
        },
      },

      payments: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          amountCents: true,
          processingFeeCents: true,
          status: true,
          paymentMethod: true,
          billingCycle: true,
          stripePaymentIntentId: true,
          stripeSessionId: true,
          createdAt: true,
          updatedAt: true,
          paidAt: true,
          failedAt: true,
          reversedAt: true,
          unit: {
            select: {
              unitNumber: true,
            },
          },
        },
      },
    },
  });

  if (!property) {
    console.log(`No property found matching "${searchName}".`);
    return;
  }

  const pendingPayments = property.payments.filter(
    (payment) => payment.status === PaymentStatus.PENDING,
  );

  const paidPayments = property.payments.filter(
    (payment) => payment.status === PaymentStatus.PAID,
  );

  const failedPayments = property.payments.filter(
    (payment) => payment.status === PaymentStatus.FAILED,
  );

  console.log("");
  console.log("====================================================");
  console.log(" ROSEMONT BERKELEY LAKE — PRODUCTION ACTIVITY CHECK");
  console.log(" READ ONLY");
  console.log("====================================================");

  console.log("");
  console.log("PROPERTY");
  console.log("----------------------------------------------------");
  console.log(`Property:                 ${property.name}`);
  console.log(`Property code:            ${property.propertyCode}`);
  console.log(`Property status:          ${property.status}`);
  console.log(`Property type:            ${property.propertyType ?? "NOT SET"}`);
  console.log(`Account created:          ${formatDate(property.createdAt)}`);
  console.log(`Property last updated:    ${formatDate(property.updatedAt)}`);

  console.log("");
  console.log("ACCOUNT / MANAGEMENT USERS");
  console.log("----------------------------------------------------");

  if (property.managementUsers.length > 0) {
    for (const user of property.managementUsers) {
      console.log(`Email:                    ${user.email}`);
      console.log(`Role:                     ${user.role}`);
      console.log(
        `Email verified:           ${yesNo(Boolean(user.emailVerifiedAt))}`,
      );
      console.log(
        `User created:             ${formatDate(user.createdAt)}`,
      );
      console.log("----------------------------------------------------");
    }
  } else {
    console.log("No management users found.");
  }

  console.log("");
  console.log("SETUP / BILLING CALENDAR");
  console.log("----------------------------------------------------");
  console.log(
    `Hard-start date:          ${formatDate(property.rentFrayStartDate)}`,
  );
  console.log(
    `Setup acknowledged:       ${formatDate(
      property.setupCompleteAcknowledgedAt,
    )}`,
  );

  if (property.settings) {
    console.log(`Rent due day:             ${property.settings.rentDueDay}`);
    console.log(
      `Grace period:             ${property.settings.gracePeriodDays} day(s)`,
    );
    console.log(
      `Late fees enabled:        ${yesNo(property.settings.lateFeeEnabled)}`,
    );

    if (property.settings.lateFeeFlatCents !== null) {
      console.log(
        `Late fee flat:            ${formatMoney(
          property.settings.lateFeeFlatCents,
        )}`,
      );
    }

    if (property.settings.lateFeePercentBps !== null) {
      console.log(
        `Late fee percent:         ${(
          property.settings.lateFeePercentBps / 100
        ).toFixed(2)}%`,
      );
    }

    console.log(
      `Onboarding complete:      ${yesNo(
        property.settings.onboardingComplete,
      )}`,
    );
    console.log(
      `Setup complete:           ${yesNo(property.settings.setupComplete)}`,
    );
    console.log(
      `Settings last updated:    ${formatDate(property.settings.updatedAt)}`,
    );
  } else {
    console.log("Property settings:        NOT FOUND");
  }

  console.log("");
  console.log("STRIPE");
  console.log("----------------------------------------------------");
  console.log(
    `Stripe account exists:    ${yesNo(Boolean(property.stripeAccountId))}`,
  );

  if (property.paymentStatus) {
    console.log(
      `Processor connected:      ${yesNo(
        property.paymentStatus.processorConnected,
      )}`,
    );
    console.log(
      `Bank connected:           ${yesNo(
        property.paymentStatus.bankConnected,
      )}`,
    );
    console.log(
      `Charges enabled:          ${yesNo(
        property.paymentStatus.chargesEnabled,
      )}`,
    );
    console.log(
      `Payouts enabled:          ${yesNo(
        property.paymentStatus.payoutsEnabled,
      )}`,
    );
    console.log(
      `Stripe onboarding:        ${yesNo(
        property.paymentStatus.onboardingComplete,
      )}`,
    );
    console.log(
      `Requirements due:         ${yesNo(
        property.paymentStatus.requirementsDue,
      )}`,
    );
    console.log(
      `Ready for live:           ${yesNo(
        property.paymentStatus.readyForLive,
      )}`,
    );
    console.log(
      `Last Stripe sync:         ${formatDate(
        property.paymentStatus.lastSyncedAt,
      )}`,
    );

    if (property.paymentStatus.requirementsSummary) {
      console.log(
        `Requirements summary:    ${property.paymentStatus.requirementsSummary}`,
      );
    }
  } else {
    console.log("Stripe status record:     NOT FOUND");
  }

  console.log("");
  console.log("CONFIGURATION PROGRESS");
  console.log("----------------------------------------------------");
  console.log(`Declared unit count:      ${property.unitCount}`);
  console.log(`Management users:         ${property._count.managementUsers}`);
  console.log(`Rent tiers:               ${property._count.tiers}`);
  console.log(`Units created:            ${property._count.units}`);
  console.log(
    `Tenant assignments:       ${property._count.tenantAssignments}`,
  );
  console.log(`Unit recurring fees:      ${property._count.recurringFees}`);
  console.log(`Payment records:          ${property._count.payments}`);

  if (property.tiers.length > 0) {
    console.log("");
    console.log("RENT TIERS");
    console.log("----------------------------------------------------");

    for (const tier of property.tiers) {
      console.log(`Tier:                     ${tier.name}`);
      console.log(`Base rent:                ${formatMoney(tier.baseRentCents)}`);
      console.log(`Configured unit count:    ${tier.unitCount}`);
      console.log(`Active unit count:        ${tier.activeUnitCount}`);
      console.log(`Due day:                  ${tier.rentDueDay}`);
      console.log(`Grace period:             ${tier.gracePeriodDays} day(s)`);
      console.log(`Initial late fee:         ${formatMoney(tier.lateFeeInitialCents)}`);
      console.log(`Daily late fee:           ${formatMoney(tier.lateFeeDailyCents)}`);
      console.log(`Max daily late-fee days:  ${tier.maxLateFeeDays}`);
      console.log(`Processing fee:           ${formatMoney(tier.processingFeeCents)}`);
      console.log(`Active:                   ${yesNo(tier.isActive)}`);
      console.log(`Created:                  ${formatDate(tier.createdAt)}`);
      console.log(`Last updated:             ${formatDate(tier.updatedAt)}`);
      console.log("----------------------------------------------------");
    }
  }

  if (property.units.length > 0) {
    console.log("");
    console.log("LATEST UNITS CREATED");
    console.log("----------------------------------------------------");

    for (const unit of property.units) {
      console.log(`Unit:                     ${unit.unitNumber}`);
      console.log(`Base rent:                ${formatMoney(unit.baseRentCents)}`);
      console.log(`Tenant portal activated:  ${yesNo(unit.portalActivated)}`);
      console.log(`Created:                  ${formatDate(unit.createdAt)}`);
      console.log(`Last updated:             ${formatDate(unit.updatedAt)}`);
      console.log("----------------------------------------------------");
    }
  }

  if (property.tenantAssignments.length > 0) {
    console.log("");
    console.log("LATEST TENANT ASSIGNMENTS");
    console.log("----------------------------------------------------");

    for (const assignment of property.tenantAssignments) {
      console.log(`Unit:                     ${assignment.unit.unitNumber}`);
      console.log(`Current assignment:       ${yesNo(assignment.isCurrent)}`);
      console.log(`Move-in date:             ${formatDate(assignment.moveInDate)}`);
      console.log(`Created:                  ${formatDate(assignment.createdAt)}`);
      console.log(`Last updated:             ${formatDate(assignment.updatedAt)}`);
      console.log("----------------------------------------------------");
    }
  }

  console.log("");
  console.log("PAYMENT ACTIVITY");
  console.log("----------------------------------------------------");
  console.log(`Total payment records:    ${property._count.payments}`);
  console.log(`Pending in latest 10:     ${pendingPayments.length}`);
  console.log(`Paid in latest 10:        ${paidPayments.length}`);
  console.log(`Failed in latest 10:      ${failedPayments.length}`);

  if (property.payments.length > 0) {
    console.log("");
    console.log("LATEST PAYMENTS");
    console.log("----------------------------------------------------");

    for (const payment of property.payments) {
      console.log(`Unit:                     ${payment.unit.unitNumber}`);
      console.log(`Status:                   ${payment.status}`);
      console.log(`Amount:                   ${formatMoney(payment.amountCents)}`);
      console.log(
        `Processing fee:           ${formatMoney(
          payment.processingFeeCents,
        )}`,
      );
      console.log(
        `Method:                   ${payment.paymentMethod ?? "Unknown"}`,
      );
      console.log(
        `Billing cycle:            ${payment.billingCycle ?? "None"}`,
      );
      console.log(`Created:                  ${formatDate(payment.createdAt)}`);
      console.log(`Last updated:             ${formatDate(payment.updatedAt)}`);
      console.log(
        `Stripe intent:            ${yesNo(
          Boolean(payment.stripePaymentIntentId),
        )}`,
      );
      console.log(
        `Stripe session:           ${yesNo(
          Boolean(payment.stripeSessionId),
        )}`,
      );

      if (payment.paidAt) {
        console.log(`Paid:                     ${formatDate(payment.paidAt)}`);
      }

      if (payment.failedAt) {
        console.log(`Failed:                   ${formatDate(payment.failedAt)}`);
      }

      if (payment.reversedAt) {
        console.log(`Reversed:                 ${formatDate(payment.reversedAt)}`);
      }

      console.log("----------------------------------------------------");
    }
  }

  console.log("");
  console.log("====================================================");
  console.log(" CURRENT ASSESSMENT");
  console.log("====================================================");

  if (property.rentFrayStartDate) {
    console.log("✓ Hard-start billing date has been set.");
  } else {
    console.log("· Hard-start billing date has NOT been set.");
  }

  if (property._count.tiers > 0) {
    console.log("✓ At least one rent tier has been configured.");
  } else {
    console.log("· No rent tiers have been configured.");
  }

  if (property._count.units > 0) {
    console.log("✓ Units have been added to RentFray.");
  } else {
    console.log("· No units have been added yet.");
  }

  if (property._count.tenantAssignments > 0) {
    console.log("✓ Tenant assignments exist.");
  } else {
    console.log("· No tenant assignments exist yet.");
  }

  if (paidPayments.length > 0) {
    console.log("");
    console.log(
      ">>> ROSEMONT HAS PROCESSED A SUCCESSFUL PAYMENT THROUGH RENTFRAY. <<<",
    );
  } else if (pendingPayments.length > 0) {
    console.log("");
    console.log(
      ">>> ROSEMONT CURRENTLY HAS A PAYMENT PROCESSING THROUGH RENTFRAY. <<<",
    );
  } else if (property._count.payments > 0) {
    console.log("");
    console.log(
      "Payment records exist, but none of the latest 10 are PENDING or PAID.",
    );
  } else {
    console.log("");
    console.log("No payment attempts have been created yet.");
  }

  console.log("====================================================");
  console.log("");
}

main()
  .catch((error: unknown) => {
    console.error("Activity check failed:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });