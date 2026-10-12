import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createManagementCredentialBinding } from "@/lib/session";

export const RECOVERY_CONFIRMATION = "If an eligible account matches these details, a password-reset email will be sent.";
const roles = ["OWNER", "MANAGER", "STAFF"];
const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const hashRecoveryToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const isRecoveryToken = (token: unknown): token is string => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);

export function recoveryAccountInput(value: unknown): { email: string; propertyCode: string } | null {
  if (!value || typeof value !== "object" || !("email" in value) || !("propertyCode" in value) ||
      typeof value.email !== "string" || typeof value.propertyCode !== "string") return null;
  const email = normalizeEmail(value.email), propertyCode = value.propertyCode.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && /^\d{4,5}$/.test(propertyCode)
    ? { email, propertyCode } : null;
}

export function recoveryPasswordInput(value: unknown): { token: string; password: string } | null {
  if (!value || typeof value !== "object" || !("token" in value) || !("password" in value) ||
      !("confirmation" in value) || !isRecoveryToken(value.token) || typeof value.password !== "string" ||
      typeof value.confirmation !== "string") return null;
  const password = value.password.trim();
  return password === value.confirmation.trim() && password.length >= 8 && Buffer.byteLength(password, "utf8") <= 72
    ? { token: value.token, password } : null;
}

// Bounded streaming input: Content-Length is not assumed to be trustworthy.
export async function readRecoveryBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > 4096) { await reader.cancel(); return null; }
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; } finally { reader.releaseLock(); }
}

export function recoverySameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const trusted = process.env.NODE_ENV === "production" ? "https://www.rentfray.com" : new URL(request.url).origin;
  return origin === trusted && request.headers.get("sec-fetch-site") !== "cross-site";
}

async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 20000 }); }
    catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
}

async function lockIdentity(tx: Prisma.TransactionClient, propertyId: string, userId: string) {
  // Lifecycle writers lock Property first. A shared lock blocks deactivation/deletion
  // without excluding unrelated membership recovery in the same property.
  await tx.$queryRaw`SELECT "id" FROM "Property" WHERE "id" = ${propertyId} FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "ManagementUser" WHERE "id" = ${userId} FOR UPDATE`;
}

async function now(tx: Prisma.TransactionClient): Promise<Date> {
  const rows = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  if (!rows[0] || !Number.isFinite(rows[0].now.getTime())) throw new Error("Recovery clock unavailable");
  return rows[0].now;
}

export async function issuePasswordRecovery(email: string, propertyCode: string): Promise<{ email: string; token: string } | null> {
  const property = await prisma.property.findUnique({ where: { propertyCode }, select: { id: true } });
  if (!property) return null;
  const matches = await prisma.managementUser.findMany({ where: { propertyId: property.id, email: { equals: email, mode: "insensitive" } }, select: { id: true }, take: 2 });
  if (matches.length !== 1) return null;
  const userId = matches[0].id;
  const token = crypto.randomBytes(32).toString("hex");
  return transaction(async (tx) => {
    await lockIdentity(tx, property.id, userId);
    const user = await tx.managementUser.findUnique({ where: { id: userId }, include: { property: true } });
    const currentMatches = await tx.managementUser.findMany({ where: { propertyId: property.id, email: { equals: email, mode: "insensitive" } }, select: { id: true }, take: 2 });
    if (!user || currentMatches.length !== 1 || currentMatches[0].id !== user.id || user.propertyId !== property.id ||
        user.property.propertyCode !== propertyCode || !user.property.isActive || !user.isActive || !roles.includes(user.role) ||
        !user.emailVerifiedAt || !user.email || normalizeEmail(user.email) !== email) return null;
    const createdAt = await now(tx);
    await tx.managementPasswordResetToken.updateMany({ where: { managementUserId: user.id, usedAt: null }, data: { usedAt: createdAt } });
    await tx.managementPasswordResetToken.create({ data: { tokenHash: hashRecoveryToken(token), managementUserId: user.id,
      propertyId: property.id, emailSnapshot: email, credentialBindingSnapshot: createManagementCredentialBinding(user.id, user.passwordHash),
      createdAt, expiresAt: new Date(createdAt.getTime() + 30 * 60 * 1000) } });
    return { email: user.email, token };
  });
}

export async function redeemPasswordRecovery(token: string, password: string): Promise<{ propertyCode: string } | null> {
  const tokenHash = hashRecoveryToken(token);
  const initial = await prisma.managementPasswordResetToken.findUnique({ where: { tokenHash }, select: { managementUserId: true, propertyId: true } });
  if (!initial) return null;
  const passwordHash = await bcrypt.hash(password, 10);
  return transaction(async (tx) => {
    await lockIdentity(tx, initial.propertyId, initial.managementUserId);
    const current = await tx.managementPasswordResetToken.findUnique({ where: { tokenHash } });
    const user = await tx.managementUser.findUnique({ where: { id: initial.managementUserId }, include: { property: true } });
    const usedAt = await now(tx);
    if (!current || current.usedAt || current.expiresAt.getTime() <= usedAt.getTime() || !user ||
        current.managementUserId !== user.id || current.propertyId !== initial.propertyId || user.propertyId !== current.propertyId ||
        !user.isActive || !user.property.isActive || !roles.includes(user.role) || !user.emailVerifiedAt || !user.email ||
        normalizeEmail(user.email) !== current.emailSnapshot ||
        createManagementCredentialBinding(user.id, user.passwordHash) !== current.credentialBindingSnapshot) return null;
    await tx.managementUser.update({ where: { id: user.id }, data: { passwordHash, mustResetPassword: false } });
    await tx.managementPasswordResetToken.updateMany({ where: { managementUserId: user.id, usedAt: null }, data: { usedAt } });
    await tx.auditLog.create({ data: { propertyId: user.propertyId, actorType: "MANAGEMENT", actorManagementUserId: user.id,
      action: "MANAGEMENT_USER_SELF_SERVICE_PASSWORD_RESET", targetType: "MANAGEMENT_USER", targetId: user.id,
      summary: "Management membership password recovered by verified email." } });
    return { propertyCode: user.property.propertyCode };
  });
}
