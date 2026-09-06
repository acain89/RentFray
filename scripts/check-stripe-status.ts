import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      createdAt: true,
      stripeAccountId: true,
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
    },
  });

  if (!property) {
    console.log(`No property found matching "${searchName}".`);
    return;
  }

  const stripeAccountCreated = Boolean(property.stripeAccountId);
  const status = property.paymentStatus;

  console.log("");
  console.log("========================================");
  console.log(" RENTFRAY STRIPE STATUS — READ ONLY");
  console.log("========================================");
  console.log(`Property:             ${property.name}`);
  console.log(`Property code:        ${property.propertyCode}`);
  console.log(`Property status:      ${property.status}`);
  console.log(`Account created:      ${property.createdAt.toISOString()}`);
  console.log("");
  console.log(`Stripe account:       ${stripeAccountCreated ? "YES" : "NO"}`);

  if (!status) {
    console.log("Payment status row:   NOT FOUND");
    console.log("");
    console.log(
      "RESULT: No PaymentConnectionStatus record exists for this property.",
    );
    return;
  }

  console.log(
    `Processor connected: ${status.processorConnected ? "YES" : "NO"}`,
  );
  console.log(`Bank connected:      ${status.bankConnected ? "YES" : "NO"}`);
  console.log(`Charges enabled:     ${status.chargesEnabled ? "YES" : "NO"}`);
  console.log(`Payouts enabled:     ${status.payoutsEnabled ? "YES" : "NO"}`);
  console.log(
    `Stripe onboarding:   ${status.onboardingComplete ? "COMPLETE" : "INCOMPLETE"}`,
  );
  console.log(
    `Requirements due:    ${status.requirementsDue ? "YES" : "NO"}`,
  );
  console.log(`Ready for live:       ${status.readyForLive ? "YES" : "NO"}`);

  if (status.requirementsSummary) {
    console.log(`Requirements:         ${status.requirementsSummary}`);
  }

  console.log(
    `Last Stripe sync:     ${
      status.lastSyncedAt
        ? status.lastSyncedAt.toISOString()
        : "Never / not recorded"
    }`,
  );

  const fullyReady =
    stripeAccountCreated &&
    status.processorConnected &&
    status.bankConnected &&
    status.chargesEnabled &&
    status.payoutsEnabled &&
    status.onboardingComplete &&
    !status.requirementsDue &&
    status.readyForLive;

  console.log("");
  console.log("----------------------------------------");

  if (fullyReady) {
    console.log("RESULT: STRIPE IS FULLY CONNECTED AND LIVE.");
  } else if (stripeAccountCreated || status.processorConnected) {
    console.log("RESULT: STRIPE SETUP HAS STARTED BUT IS NOT FULLY READY.");
  } else {
    console.log("RESULT: STRIPE HAS NOT BEEN CONNECTED.");
  }

  console.log("----------------------------------------");
  console.log("");
}

main()
  .catch((error: unknown) => {
    console.error("Stripe status check failed:");

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