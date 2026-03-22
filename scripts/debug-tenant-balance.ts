// [path: scripts/debug-tenant-balance.ts]

import { prisma } from "../lib/prisma";
import { getUnitLedgerSummary } from "../lib/ledger";
import { getUnitDelinquencySummary } from "../lib/delinquency";

async function main() {
  const unit = await prisma.unit.findFirst({
    where: {
      property: { propertyCode: "1234" },
      unitNumber: "101",
    },
    select: {
      id: true,
      propertyId: true,
      unitNumber: true,
    },
  });

  if (!unit) {
    throw new Error("Unit not found");
  }

  console.log("UNIT");
  console.dir(unit, { depth: 5 });

  console.log("LEDGER");
  const ledger = await getUnitLedgerSummary(unit.id);
  console.dir(ledger, { depth: 5 });

  console.log("DELINQUENCY");
  const delinquency = await getUnitDelinquencySummary(unit.id);
  console.dir(delinquency, { depth: 5 });
}

main()
  .catch((err) => {
    console.error("DEBUG FAILED");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });