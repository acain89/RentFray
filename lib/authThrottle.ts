import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_RETRIES = 3;
type Admission = { admitted: true } | { admitted: false; retryAfter: number };
type Bucket = { attemptCount: number; windowExpiresAt: Date };

async function consume(tx: Prisma.TransactionClient, key: string, limit: number): Promise<Admission> {
  await tx.$executeRaw`
    INSERT INTO "AuthThrottleBucket" ("key", "attemptCount", "windowExpiresAt")
    VALUES (${key}, 0, TIMESTAMPTZ 'epoch') ON CONFLICT ("key") DO NOTHING
  `;
  const rows = await tx.$queryRaw<Bucket[]>`
    SELECT "attemptCount", "windowExpiresAt" FROM "AuthThrottleBucket"
    WHERE "key" = ${key} FOR UPDATE
  `;
  if (!rows[0]) throw new Error("Authentication admission bucket missing");
  // Read shared time after the row lock, including any lock wait.
  const times = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  const now = times[0]?.now;
  if (!now || !Number.isFinite(now.getTime())) throw new Error("Authentication admission clock unavailable");
  const bucket = rows[0];
  if (now.getTime() >= bucket.windowExpiresAt.getTime()) {
    const expires = new Date(now.getTime() + WINDOW_MS);
    await tx.$executeRaw`
      UPDATE "AuthThrottleBucket" SET "attemptCount" = 1, "windowExpiresAt" = ${expires}
      WHERE "key" = ${key}
    `;
  } else {
    if (bucket.attemptCount >= limit) {
      return { admitted: false, retryAfter: Math.max(1, Math.ceil((bucket.windowExpiresAt.getTime() - now.getTime()) / 1000)) };
    }
    await tx.$executeRaw`
      UPDATE "AuthThrottleBucket" SET "attemptCount" = "attemptCount" + 1 WHERE "key" = ${key}
    `;
  }
  return { admitted: true };
}

function retryable(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string } } | null;
  return e?.code === "P2034" || ["40001", "40P01"].includes(e?.code ?? "") ||
    (e?.code === "P2010" && ["40001", "40P01"].includes(e.meta?.code ?? ""));
}

async function cleanup(): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const expired = await tx.$queryRaw<{ key: string }[]>`
      SELECT "key" FROM "AuthThrottleBucket" WHERE "windowExpiresAt" <= clock_timestamp()
      ORDER BY "windowExpiresAt", "key" LIMIT 100 FOR UPDATE SKIP LOCKED
    `;
    for (const row of expired) {
      await tx.$executeRaw`
        DELETE FROM "AuthThrottleBucket" WHERE "key" = ${row.key}
        AND "windowExpiresAt" <= clock_timestamp()
      `;
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

async function admit<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let result: T;
  for (let retry = 0; ; retry++) {
    try {
      result = await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
      break;
    } catch (error) {
      if (retry >= MAX_RETRIES || !retryable(error)) throw error;
    }
  }
  // Admission has committed; cleanup cannot undo or grant capacity.
  try { await cleanup(); } catch { console.error("Authentication throttle cleanup failed"); }
  return result;
}

export async function admitAdminLogin(): Promise<Admission> {
  return admit((tx) => consume(tx, "admin:global", 10));
}

export async function admitMaintenanceLogin(propertyCode: string) {
  return admit(async (tx) => {
    const global = await consume(tx, "maintenance:global", 100);
    if (!global.admitted) return global;
    const property = await tx.property.findUnique({
      where: { propertyCode },
      select: { id: true, status: true, isActive: true },
    });
    if (!property) return { admitted: true as const, property: null };
    const scoped = await consume(tx, `maintenance:property:${property.id}`, 10);
    if (!scoped.admitted) return scoped;
    return { admitted: true as const, property };
  });
}
