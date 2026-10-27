import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const REPRESENTATIVE_SESSION_COOKIE = "rf_representative_session";
export const REPRESENTATIVE_SESSION_SECONDS = 8 * 60 * 60;
export const representativePrivateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Cookie" };
export const representativeSessionOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/",
};
const audience = "rentfray:representative";
const namespace = "rentfray:representative-session:v1:";
type Token = { aud: string; representativeId: string; version: number; iat: number; exp: number };
export type RepresentativeSession = { id: string; displayName: string; sessionVersion: number };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || !value.trim() || Buffer.byteLength(value, "utf8") < 32 || value === "rentfray-dev-session-secret-change-me") {
    throw new Error("Representative session configuration unavailable.");
  }
  return value;
}
export function isRepresentativeBcryptHash(value: string | null): value is string {
  return typeof value === "string" && /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(value);
}
export function createRepresentativeSessionToken(id: string, version: number, now = new Date()): string {
  if (!id || id.length > 128 || !Number.isSafeInteger(version) || version < 0 || !Number.isFinite(now.getTime())) throw new Error("Invalid representative session.");
  const iat = Math.floor(now.getTime() / 1000);
  const payload = Buffer.from(JSON.stringify({ aud: audience, representativeId: id, version, iat, exp: iat + REPRESENTATIVE_SESSION_SECONDS })).toString("base64url");
  return payload + "." + createHmac("sha256", secret()).update(namespace + payload).digest("base64url");
}
export function readRepresentativeSessionToken(value: string | undefined, now = new Date()): Token | null {
  if (!value || value.length > 2048 || !Number.isFinite(now.getTime())) return null;
  try {
    const [payload, signature, extra] = value.split(".");
    if (extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(payload ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(signature ?? "")) return null;
    const supplied = Buffer.from(signature, "base64url");
    const expected = createHmac("sha256", secret()).update(namespace + payload).digest();
    if (supplied.toString("base64url") !== signature || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const token = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const seconds = Math.floor(now.getTime() / 1000);
    if (!token || Object.keys(token).sort().join(",") !== "aud,exp,iat,representativeId,version" || token.aud !== audience ||
      typeof token.representativeId !== "string" || !token.representativeId || token.representativeId.length > 128 ||
      !Number.isSafeInteger(token.version) || token.version < 0 || !Number.isSafeInteger(token.iat) || token.iat < 0 || token.iat > seconds ||
      token.exp !== token.iat + REPRESENTATIVE_SESSION_SECONDS || seconds >= token.exp) return null;
    return token;
  } catch { return null; }
}
export async function validateRepresentativeSession(value: string | undefined): Promise<RepresentativeSession | null> {
  const token = readRepresentativeSessionToken(value);
  if (!token) return null;
  const row = await prisma.representative.findUnique({ where: { id: token.representativeId },
    select: { id: true, displayName: true, loginEnabled: true, sessionVersion: true, passwordHash: true } });
  return row && row.loginEnabled && isRepresentativeBcryptHash(row.passwordHash) && row.sessionVersion === token.version
    ? { id: row.id, displayName: row.displayName, sessionVersion: row.sessionVersion } : null;
}
export async function getRepresentativeSession(): Promise<RepresentativeSession | null> {
  return validateRepresentativeSession((await cookies()).get(REPRESENTATIVE_SESSION_COOKIE)?.value);
}
export async function setRepresentativeSession(token: string) {
  (await cookies()).set(REPRESENTATIVE_SESSION_COOKIE, token, { ...representativeSessionOptions, maxAge: REPRESENTATIVE_SESSION_SECONDS });
}
export async function clearRepresentativeSession() {
  (await cookies()).set(REPRESENTATIVE_SESSION_COOKIE, "", { ...representativeSessionOptions, maxAge: 0 });
}
export function representativeSameOrigin(request: Request): boolean {
  const origin = process.env.NODE_ENV === "production" ? "https://www.rentfray.com" : new URL(request.url).origin;
  return request.headers.get("origin") === origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
export async function readRepresentativeBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !request.body) return null;
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > 4096) { await reader.cancel(); return null; }
      chunks.push(result.value);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; } finally { reader.releaseLock(); }
}
