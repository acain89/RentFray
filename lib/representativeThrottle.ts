import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Admission = { admitted: true } | { admitted: false; retryAfter: number };
async function consume(tx: Prisma.TransactionClient, key: string, limit: number, windowMs: number): Promise<Admission> {
  await tx.$executeRaw`INSERT INTO "AuthThrottleBucket" ("key", "attemptCount", "windowExpiresAt")
    VALUES (${key}, 0, TIMESTAMPTZ 'epoch') ON CONFLICT ("key") DO NOTHING`;
  const [row] = await tx.$queryRaw<{ attemptCount: number; windowExpiresAt: Date }[]>`
    SELECT "attemptCount", "windowExpiresAt" FROM "AuthThrottleBucket" WHERE "key" = ${key} FOR UPDATE`;
  const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  if (!row || !now) throw new Error("Representative authentication throttle unavailable.");
  if (now < row.windowExpiresAt && row.attemptCount >= limit) return { admitted: false, retryAfter: Math.max(1, Math.ceil((row.windowExpiresAt.getTime() - now.getTime()) / 1000)) };
  const expired = now >= row.windowExpiresAt;
  await tx.authThrottleBucket.update({ where: { key }, data: {
    attemptCount: expired ? 1 : row.attemptCount + 1, windowExpiresAt: expired ? new Date(now.getTime() + windowMs) : row.windowExpiresAt,
  } });
  return { admitted: true };
}
export async function admitRepresentativeAuth(kind: "login" | "request" | "reset", identity: string): Promise<Admission> {
  const digest = createHash("sha256").update(identity).digest("hex");
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const windowMs = kind === "login" ? 5 * 60 * 1000 : 60 * 60 * 1000;
        const global = await consume(tx, `representative:${kind}:global`, kind === "login" ? 200 : 300, windowMs);
        if (!global.admitted) return global;
        const result = await consume(tx, `representative:${kind}:${digest}`, kind === "login" ? 10 : 5, windowMs);
        // Bounded, representative-only cleanup; other roles' buckets are untouched.
        await tx.$executeRaw`DELETE FROM "AuthThrottleBucket" WHERE "key" IN (
          SELECT "key" FROM "AuthThrottleBucket" WHERE "key" LIKE 'representative:%' AND "windowExpiresAt" <= clock_timestamp()
          ORDER BY "windowExpiresAt", "key" LIMIT 25 FOR UPDATE SKIP LOCKED)`;
        return result;
      });
    } catch (error) {
      const value = error as { code?: string; meta?: { code?: string } };
      const retryable = value.code === "P2034" || ["40001", "40P01"].includes(value.code ?? "") ||
        (value.code === "P2010" && ["40001", "40P01"].includes(value.meta?.code ?? ""));
      if (!retryable || attempt >= 2) throw error;
    }
  }
}
