// lib/session.ts

import crypto from "crypto";

export type SessionRole = "MANAGER" | "TENANT" | "MAINTENANCE";

export type SessionPayload = {
  role: SessionRole;
  propertyId: string;
  unitId?: string;
  iat: number;
  exp: number;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  return process.env.SESSION_SECRET || "rentfray-dev-session-secret-change-me";
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function sign(value: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", getSessionSecret()).update(value).digest()
  );
}

export function createSessionToken(input: {
  role: SessionRole;
  propertyId: string;
  unitId?: string;
}) {
  const now = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    role: input.role,
    propertyId: input.propertyId,
    unitId: input.unitId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = sign(encodedPayload);

    if (signature !== expectedSignature) {
      return null;
    }

    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

    if (!parsed?.role || !parsed?.propertyId || !parsed?.iat || !parsed?.exp) {
      return null;
    }

    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (
      parsed.role !== "MANAGER" &&
      parsed.role !== "TENANT" &&
      parsed.role !== "MAINTENANCE"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function getSession() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("rf_session")?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requireRole(role: SessionRole) {
  const session = await requireSession();

  if (session.role !== role) {
    throw new Error("Forbidden");
  }

  return session;
}