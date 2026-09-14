import { runMonthlyRentJob } from "../jobs/monthlyRent";

const PROPERTY_ID = "cmsryk9t20003wpgbj1agr0xy";

// Deliberately use September 14 after the property's due date
// in America/Chicago. The corrected billing engine should:
// - recognize August obligations already exist
// - create missing September obligations
// - skip units without a current tenant
const AS_OF = new Date("2026-09-14T18:00:00.000Z");

async function main() {
  console.log("====================================================");
  console.log(" RENTFRAY TARGETED BILLING REPAIR");
  console.log("====================================================");
  console.log("Property ID:", PROPERTY_ID);
  console.log("As of:", AS_OF.toISOString());
  console.log("");

  const result = await runMonthlyRentJob(AS_OF, PROPERTY_ID);

  console.log("");
  console.log("RESULT");
  console.log("====================================================");
  console.dir(result, { depth: null });

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("TARGETED REPAIR FAILED");
  console.error(error);
  process.exitCode = 1;
});