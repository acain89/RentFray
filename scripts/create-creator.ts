import { Prisma, PrismaClient } from "@prisma/client";
import { requireCreatorSlug } from "../lib/creatorSlugRules";
import { creatorAnniversary, creatorStatus, CREATOR_ORIGIN } from "../lib/creatorReferrals";

const prisma = new PrismaClient();
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--name" || args[2] !== "--slug") {
    throw new Error('Usage: npx tsx scripts/create-creator.ts --name "Sean Pan" --slug seanpan');
  }
  const name = args[1].trim();
  if (!name || name.length > 200 || Array.from(name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error("Name must be 1–200 printable characters.");
  const slug = requireCreatorSlug(args[3]);
  const startsAt = new Date();
  const creator = await prisma.creator.create({ data: { name, slug, startsAt,
    expiresAt: creatorAnniversary(startsAt), createdAt: startsAt } });
  console.log("\nRENTFRAY CREATOR REFERRAL PROGRAM\n" + "=".repeat(60));
  console.log(`Creator name: ${creator.name}\nReferral URL: ${CREATOR_ORIGIN}/${creator.slug}\nCreator ID: ${creator.id}`);
  console.log(`Status: ${creatorStatus(creator.expiresAt)}\nStart date: ${creator.startsAt.toISOString()}\nExpiration date: ${creator.expiresAt.toISOString()}`);
  console.log("Calendar: America/Chicago (Feb 29 → Feb 28; DST gap forward, repeated time earlier)");
  console.log("Commission: $2.50 per qualifying payment\nReferred businesses: 0\nRegistered units: 0\nSuccessful qualifying payments: 0\nCreator commission: $0.00\n");
}
main().catch((error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") console.error("Creator slug already exists.");
  else if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError) console.error("Creator creation failed; check database configuration and migration status.");
  else console.error(error instanceof Error ? error.message : "Creator creation failed.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());