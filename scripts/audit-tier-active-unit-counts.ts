import { PrismaClient } from "@prisma/client";

// Intentionally does not load .env or fall back to DATABASE_URL. Supply an
// explicitly chosen connection, preferably using a SELECT-only database role.
// Run: AUDIT_DATABASE_URL=... npx tsx scripts/audit-tier-active-unit-counts.ts
type TierAuditRow = {
  tierId: string;
  propertyId: string;
  tierIsActive: boolean;
  storedCount: number;
  actualCount: number;
  capacity: number;
};

async function main() {
  const url = process.env.AUDIT_DATABASE_URL;
  if (!url) throw new Error("AUDIT_DATABASE_URL must be explicitly supplied.");
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      // One statement supplies a consistent snapshot, including empty and
      // inactive tiers. No customer names, credentials, or financial data.
      return tx.$queryRaw<TierAuditRow[]>`
        SELECT t."id" AS "tierId", t."propertyId", t."isActive" AS "tierIsActive",
               t."activeUnitCount" AS "storedCount", t."unitCount" AS "capacity",
               COUNT(u."id")::integer AS "actualCount"
        FROM "PropertyTier" t
        LEFT JOIN "Unit" u ON u."tierId" = t."id" AND u."isActive" = true
        GROUP BY t."id"
        ORDER BY t."propertyId", t."id"
      `;
    });
    const findings = rows.filter(row =>
      row.storedCount !== row.actualCount || row.actualCount > row.capacity);
    console.log(JSON.stringify({
      tiersChecked: rows.length,
      discrepancies: rows.filter(row => row.storedCount !== row.actualCount).length,
      capacityOverruns: rows.filter(row => row.actualCount > row.capacity).length,
      findings: findings.map(row => ({ ...row,
        discrepancy: row.storedCount !== row.actualCount,
        capacityOverrun: row.actualCount > row.capacity,
      })),
    }, null, 2));
    if (findings.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Raw Prisma errors can contain connection details; never print them.
  console.error("Tier counter audit failed. Check the explicit audit connection and permissions.");
  process.exitCode = 2;
});
