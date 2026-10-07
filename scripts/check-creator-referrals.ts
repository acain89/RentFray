import { Prisma, PrismaClient } from "@prisma/client";
import { requireCreatorSlug } from "../lib/creatorSlugRules";
import { creatorReports, CREATOR_ORIGIN } from "../lib/creatorReferrals";

const prisma = new PrismaClient();
function money(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Commission total exceeds safe integer limits.");
  return `$${(cents / 100).toFixed(2)}`;
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--slug")) throw new Error("Usage: npx tsx scripts/check-creator-referrals.ts [--slug seanpan]");
  const slug = args.length ? requireCreatorSlug(args[1]) : undefined;
  const now = new Date();
  const reports = await prisma.$transaction(tx => creatorReports(tx, slug, now),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
  if (slug && !reports.length) throw new Error("Creator not found.");
  const combined = { businesses: 0, units: 0, payments: 0, cents: 0 };
  console.log(`\nRENTFRAY CREATOR REPORT — ${now.toISOString()}\nCommission: $2.50 per qualifying payment`);
  for (const report of reports) {
    const { creator } = report;
    console.log(`\n${"=".repeat(60)}\nCreator: ${creator.name}\nURL: ${CREATOR_ORIGIN}/${creator.slug}\nCreator ID: ${creator.id}\nStatus: ${report.status}`);
    console.log(`Starts: ${creator.startsAt.toISOString()}\nExpires: ${creator.expiresAt.toISOString()}\nCalendar: America/Chicago`);
    const totals = { units: 0, payments: 0, cents: 0 };
    for (const business of report.businesses) {
      console.log(`\nBusiness: ${business.name}${business.deleted ? " (deleted; retained attribution)" : ""}\nProperty ID: ${business.propertyId}`);
      console.log(`Registered active units: ${business.units}\nQualifying successful payments: ${business.payments}\nCommission earned: ${money(business.commissionCents)}`);
      totals.units += business.units; totals.payments += business.payments; totals.cents += business.commissionCents;
    }
    console.log(`\nReferred businesses: ${report.businesses.length}\nRegistered units: ${totals.units}\nSuccessful qualifying payments: ${totals.payments}\nCreator commission: ${money(totals.cents)}`);
    combined.businesses += report.businesses.length; combined.units += totals.units;
    combined.payments += totals.payments; combined.cents += totals.cents;
  }
  if (!slug) console.log(`\nCOMBINED TOTALS\nCreators: ${reports.length}\nBusinesses: ${combined.businesses}\nRegistered units: ${combined.units}\nSuccessful qualifying payments: ${combined.payments}\nCommission: ${money(combined.cents)}`);
}
main().catch((error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError) console.error("Read-only report failed; check database configuration and migration status.");
  else console.error(error instanceof Error ? error.message : "Read-only report failed.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());