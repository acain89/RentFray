import { prisma } from "../lib/prisma";

async function main(): Promise<void> {
  const duplicateAssignments = await prisma.$queryRaw<
    Array<{
      unitId: string;
      duplicateCount: bigint;
    }>
  >`
    SELECT
      "unitId",
      COUNT(*) AS "duplicateCount"
    FROM "TenantAssignment"
    WHERE
      "isCurrent" = true
      AND "moveOutDate" IS NULL
    GROUP BY "unitId"
    HAVING COUNT(*) > 1
  `;

  const duplicatePaymentEntries = await prisma.$queryRaw<
    Array<{
      paymentId: string;
      duplicateCount: bigint;
    }>
  >`
    SELECT
      "paymentId",
      COUNT(*) AS "duplicateCount"
    FROM "LedgerEntry"
    WHERE
      "paymentId" IS NOT NULL
      AND "entryType" = 'PAYMENT'
    GROUP BY "paymentId"
    HAVING COUNT(*) > 1
  `;

  const duplicateProcessingFees = await prisma.$queryRaw<
    Array<{
      paymentId: string;
      duplicateCount: bigint;
    }>
  >`
    SELECT
      "paymentId",
      COUNT(*) AS "duplicateCount"
    FROM "LedgerEntry"
    WHERE
      "paymentId" IS NOT NULL
      AND "entryType" = 'CHARGE'
      AND "chargeType" = 'PROCESSING_FEE'
    GROUP BY "paymentId"
    HAVING COUNT(*) > 1
  `;

  const duplicateReversals = await prisma.$queryRaw<
    Array<{
      paymentId: string;
      duplicateCount: bigint;
    }>
  >`
    SELECT
      "paymentId",
      COUNT(*) AS "duplicateCount"
    FROM "LedgerEntry"
    WHERE
      "paymentId" IS NOT NULL
      AND "entryType" = 'ADJUSTMENT'
      AND "referenceNumber" LIKE '%:reversal'
    GROUP BY "paymentId"
    HAVING COUNT(*) > 1
  `;

  const normalize = (
    rows: Array<Record<string, unknown>>
  ): Array<Record<string, unknown>> =>
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === "bigint" ? Number(value) : value,
        ])
      )
    );

  console.log("\nDuplicate current assignments:");
  console.table(normalize(duplicateAssignments));

  console.log("\nDuplicate payment ledger entries:");
  console.table(normalize(duplicatePaymentEntries));

  console.log("\nDuplicate processing-fee entries:");
  console.table(normalize(duplicateProcessingFees));

  console.log("\nDuplicate reversal entries:");
  console.table(normalize(duplicateReversals));

  const totalProblems =
    duplicateAssignments.length +
    duplicatePaymentEntries.length +
    duplicateProcessingFees.length +
    duplicateReversals.length;

  if (totalProblems > 0) {
    throw new Error(
      `Database uniqueness audit found ${totalProblems} conflict group(s).`
    );
  }

  console.log("\nPASS: No conflicting rows were found.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });