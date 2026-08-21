import { prisma } from "../lib/prisma";
import { runLateFeesJob } from "../jobs/lateFees";
import { runMonthlyRentJob } from "../jobs/monthlyRent";

async function main(): Promise<void> {
  const asOf = new Date();

  console.log("[billing-cron] Starting", {
    asOf: asOf.toISOString(),
  });

  const monthlyRent = await runMonthlyRentJob(asOf);

  console.log("[billing-cron] Monthly rent result", monthlyRent);

  const lateFees = await runLateFeesJob(asOf);

  console.log("[billing-cron] Late-fee result", lateFees);

  const failedUnits = monthlyRent.failedUnits + lateFees.failedUnits;

  if (failedUnits > 0) {
    console.error("[billing-cron] Completed with isolated unit failures", {
      failedUnits,
      monthlyRentFailures: monthlyRent.failures,
      lateFeeFailures: lateFees.failures,
    });

    process.exitCode = 1;
    return;
  }

  console.log("[billing-cron] Completed successfully", {
    monthlyRentChargesCreated: monthlyRent.rentChargesCreated,
    recurringFeeChargesCreated: monthlyRent.recurringFeeChargesCreated,
    lateFeeChargesCreated: lateFees.posted,
  });
}

main()
  .catch((error: unknown) => {
    console.error("[billing-cron] Fatal error", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });