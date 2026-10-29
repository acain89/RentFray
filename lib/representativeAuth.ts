import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRepresentativeBcryptHash, type RepresentativeSession } from "@/lib/representativeSession";

export const REPRESENTATIVE_RECOVERY_MESSAGE = "If an eligible account matches this email, a password-reset link will be sent.";
export function representativeEmailInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function representativePasswordInput(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
}
export const isRepresentativeResetToken = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export type RepresentativePasswordLink = { email: string; token: string; purpose: "ACTIVATION" | "PASSWORD_RESET" };

export async function authenticateRepresentative(email: string, password: string): Promise<RepresentativeSession | null> {
  const row = await prisma.representative.findUnique({ where: { email },
    select: { id: true, displayName: true, passwordHash: true, sessionVersion: true, loginEnabled: true } });
  // Always do cost-12 work, including unknown, disabled, and unset credentials.
  const valid = Boolean(row?.loginEnabled && isRepresentativeBcryptHash(row.passwordHash));
  const hash = valid ? row!.passwordHash! : "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYzp8IEXiCu5IqRFjLUsNnki7XQpLwAu";
  const matches = await bcrypt.compare(password, hash);
  if (!valid || !matches || !row) return null;
  const current = await prisma.representative.findUnique({ where: { id: row.id },
    select: { loginEnabled: true, passwordHash: true, sessionVersion: true } });
  return current?.loginEnabled && current.passwordHash === row.passwordHash && current.sessionVersion === row.sessionVersion
    ? { id: row.id, displayName: row.displayName, sessionVersion: row.sessionVersion } : null;
}

export function issueRepresentativeRecovery(email: string): Promise<RepresentativePasswordLink | null> {
  return issueRepresentativePasswordLink(email, false);
}
export function issueRepresentativeSetup(email: string): Promise<RepresentativePasswordLink | null> {
  return issueRepresentativePasswordLink(email, true);
}
async function issueRepresentativePasswordLink(email: string, initialSetup: boolean): Promise<RepresentativePasswordLink | null> {
  const initial = await prisma.representative.findUnique({ where: { email }, select: { id: true } });
  if (!initial) return null;
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT "id" FROM "Representative" WHERE "id" = ${initial.id} FOR UPDATE`;
    const row = await tx.representative.findUnique({ where: { id: initial.id }, select: { email: true, loginEnabled: true, sessionVersion: true, passwordHash: true } });
    if (!row?.loginEnabled || row.email !== email) return null;
    // Only administrator setup for an account without credentials is activation.
    // Public recovery always stays at 30 minutes, including unactivated accounts.
    // Decide under the row lock; existing tokens keep their stored expiry.
    const purpose: RepresentativePasswordLink["purpose"] = initialSetup && row.passwordHash === null ? "ACTIVATION" : "PASSWORD_RESET";
    const lifetime = purpose === "ACTIVATION" ? 168 * 60 * 60 * 1000 : 30 * 60 * 1000;
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
    const token = randomBytes(32).toString("hex");
    await tx.representative.update({ where: { id: initial.id }, data: {
      resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(now.getTime() + lifetime), resetTokenSessionVersion: row.sessionVersion,
    } });
    return { email: row.email, token, purpose };
  });
}
export async function redeemRepresentativeRecovery(token: string, password: string): Promise<boolean> {
  if (!isRepresentativeResetToken(token) || !representativePasswordInput(password)) return false;
  const tokenHash = hashToken(token);
  const initial = await prisma.representative.findUnique({ where: { resetTokenHash: tokenHash }, select: { id: true } });
  if (!initial) return false;
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT "id" FROM "Representative" WHERE "id" = ${initial.id} FOR UPDATE`;
    const row = await tx.representative.findUnique({ where: { id: initial.id }, select: {
      loginEnabled: true, sessionVersion: true, resetTokenHash: true, resetTokenExpiresAt: true, resetTokenSessionVersion: true,
    } });
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
    if (!row?.loginEnabled || row.resetTokenHash !== tokenHash || !row.resetTokenExpiresAt || row.resetTokenExpiresAt <= now ||
      row.resetTokenSessionVersion !== row.sessionVersion) return false;
    await tx.representative.update({ where: { id: initial.id }, data: { passwordHash, sessionVersion: { increment: 1 },
      resetTokenHash: null, resetTokenExpiresAt: null, resetTokenSessionVersion: null } });
    return true;
  });
}
export async function revokeRepresentativeSessions(session: RepresentativeSession) {
  await prisma.representative.updateMany({ where: { id: session.id, sessionVersion: session.sessionVersion }, data: {
    sessionVersion: { increment: 1 }, resetTokenHash: null, resetTokenExpiresAt: null, resetTokenSessionVersion: null,
  } });
}
