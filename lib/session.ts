// lib/session.ts

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type SessionRole =
  | "ADMIN"
  | "OWNER"
  | "MANAGER"
  | "STAFF"
  | "TENANT"
  | "MAINTENANCE";

export type SessionPayload = {
  role: SessionRole;
  propertyId?: string;
  adminAccessId?: string;
  managementUserId?: string;
  managementCredentialBinding?: string;
  unitId?: string;
  tenantAssignmentId?: string;
  maintenanceUserId?: string;
  iat: number;
  exp: number;
};

type CreateSessionInput =
  | {
      role: "ADMIN";
      adminAccessId: string;
    }
  | {
      role: "OWNER" | "MANAGER" | "STAFF";
      propertyId: string;
      managementUserId: string;
      managementCredentialBinding: string;
    }
  | {
      role: "TENANT";
      propertyId: string;
      unitId: string;
      tenantAssignmentId: string;
    }
  | {
      role: "MAINTENANCE";
      propertyId: string;
      maintenanceUserId: string;
    };

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_COOKIE_NAME = "rf_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (
    typeof secret !== "string" ||
    secret.trim().length === 0 ||
    Buffer.byteLength(secret, "utf8") < 32 ||
    secret === "rentfray-dev-session-secret-change-me"
  ) {
    throw new Error("Invalid session configuration.");
  }
  return secret;
}

export function validateSessionConfiguration(): void {
  getSessionSecret();
}

export function createManagementCredentialBinding(userId: string, passwordHash: string): string {
  if (!isNonEmptyString(userId) || !isNonEmptyString(passwordHash)) {
    throw new Error("Invalid management credential.");
  }
  return crypto.createHmac("sha256", getSessionSecret())
    .update(JSON.stringify(["rentfray:management-credential-binding:v1", userId, passwordHash]))
    .digest("hex");
}

function isManagementCredentialBinding(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
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
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function sign(value: string) {
  return base64UrlEncode(
    crypto.createHmac("sha256", getSessionSecret()).update(value).digest()
  );
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isValidRole(role: unknown): role is SessionRole {
  return (
    role === "ADMIN" ||
    role === "OWNER" ||
    role === "MANAGER" ||
    role === "STAFF" ||
    role === "TENANT" ||
    role === "MAINTENANCE"
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidPayloadShape(parsed: Partial<SessionPayload>): parsed is SessionPayload {
  if (!parsed || !isValidRole(parsed.role)) {
    return false;
  }

  if (typeof parsed.iat !== "number" || typeof parsed.exp !== "number") {
    return false;
  }

  if (parsed.propertyId !== undefined && !isNonEmptyString(parsed.propertyId)) {
    return false;
  }

  if (
    parsed.adminAccessId !== undefined &&
    !isNonEmptyString(parsed.adminAccessId)
  ) {
    return false;
  }

  if (
    parsed.managementUserId !== undefined &&
    !isNonEmptyString(parsed.managementUserId)
  ) {
    return false;
  }

  if (parsed.unitId !== undefined && !isNonEmptyString(parsed.unitId)) {
    return false;
  }

  if (
    parsed.maintenanceUserId !== undefined &&
    !isNonEmptyString(parsed.maintenanceUserId)
  ) {
    return false;
  }

  if (parsed.role === "ADMIN") {
    return isNonEmptyString(parsed.adminAccessId);
  }

  if (
    parsed.role === "OWNER" ||
    parsed.role === "MANAGER" ||
    parsed.role === "STAFF"
  ) {
    return (
      isNonEmptyString(parsed.propertyId) &&
      isNonEmptyString(parsed.managementUserId) &&
      isManagementCredentialBinding(parsed.managementCredentialBinding)
    );
  }

  if (parsed.role === "TENANT") {
    return (
      isNonEmptyString(parsed.propertyId) &&
      isNonEmptyString(parsed.unitId) &&
      isNonEmptyString(parsed.tenantAssignmentId)
    );
  }

  if (parsed.role === "MAINTENANCE") {
    return (
      isNonEmptyString(parsed.propertyId) &&
      isNonEmptyString(parsed.maintenanceUserId)
    );
  }

  return false;
}

export function createSessionToken(input: CreateSessionInput) {
  const now = Math.floor(Date.now() / 1000);

  let payload: SessionPayload;

  switch (input.role) {
    case "ADMIN":
      if (!isNonEmptyString(input.adminAccessId)) {
        throw new Error("Invalid admin session.");
      }
      payload = {
        role: "ADMIN",
        adminAccessId: input.adminAccessId,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      };
      break;

    case "OWNER":
    case "MANAGER":
    case "STAFF":
      if (!isManagementCredentialBinding(input.managementCredentialBinding)) {
        throw new Error("Invalid management session.");
      }
      payload = {
        role: input.role,
        propertyId: input.propertyId,
        managementUserId: input.managementUserId,
        managementCredentialBinding: input.managementCredentialBinding,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      };
      break;

    case "TENANT":
      if (!isNonEmptyString(input.propertyId) || !isNonEmptyString(input.unitId) || !isNonEmptyString(input.tenantAssignmentId)) {
        throw new Error("Invalid tenant session.");
      }
      payload = {
        role: "TENANT",
        propertyId: input.propertyId,
        unitId: input.unitId,
        tenantAssignmentId: input.tenantAssignmentId,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      };
      break;

    case "MAINTENANCE":
      payload = {
        role: "MAINTENANCE",
        propertyId: input.propertyId,
        maintenanceUserId: input.maintenanceUserId,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      };
      break;
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, signature] = parts;

    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = sign(encodedPayload);

    if (!safeEqual(signature, expectedSignature)) {
      return null;
    }

    const parsed = JSON.parse(
      base64UrlDecode(encodedPayload)
    ) as Partial<SessionPayload>;

    const now = Math.floor(Date.now() / 1000);

    if (!isValidPayloadShape(parsed)) {
      return null;
    }

    if (parsed.exp <= now) {
      return null;
    }

    if (parsed.iat > now + 60) {
      return null;
    }

    return {
      role: parsed.role,
      ...(parsed.propertyId ? { propertyId: parsed.propertyId } : {}),
      ...(parsed.adminAccessId ? { adminAccessId: parsed.adminAccessId } : {}),
      ...(parsed.managementUserId
        ? { managementUserId: parsed.managementUserId }
        : {}),
      ...((parsed.role === "OWNER" || parsed.role === "MANAGER" || parsed.role === "STAFF")
        ? { managementCredentialBinding: parsed.managementCredentialBinding }
        : {}),
      ...(parsed.unitId ? { unitId: parsed.unitId } : {}),
      ...(parsed.role === "TENANT"
        ? { tenantAssignmentId: parsed.tenantAssignmentId }
        : {}),
      ...(parsed.maintenanceUserId
        ? { maintenanceUserId: parsed.maintenanceUserId }
        : {}),
      iat: parsed.iat,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export type SessionValidationOptions = Readonly<{ strictAuthority?: boolean }>;

// Only errors created by session authorization may become 401/403 responses.
export class SessionAuthorizationError extends Error {
  readonly status: 401 | 403;
  constructor(status: 401 | 403) {
    super(status === 401 ? "Unauthorized" : "Forbidden");
    this.name = "SessionAuthorizationError";
    this.status = status;
  }
}

async function hasCurrentManagementAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {
  if (!isNonEmptyString(session.managementUserId) || !isNonEmptyString(session.propertyId) ||
      !isManagementCredentialBinding(session.managementCredentialBinding)) {
    return false;
  }

  try {
    const user = await prisma.managementUser.findUnique({
      where: { id: session.managementUserId },
      select: {
        id: true,
        isActive: true,
        propertyId: true,
        role: true,
        passwordHash: true,
      },
    });

    return Boolean(
      user &&
      user.id === session.managementUserId &&
      user.isActive &&
      user.propertyId === session.propertyId &&
      (user.role === "OWNER" || user.role === "MANAGER" || user.role === "STAFF") &&
      user.role === session.role &&
      isNonEmptyString(user.passwordHash) &&
      safeEqual(session.managementCredentialBinding, createManagementCredentialBinding(user.id, user.passwordHash))
    );
  } catch (error) {
    if (options.strictAuthority) throw error;
    return false;
  }
}

async function hasCurrentTenantAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {
  if (!isNonEmptyString(session.tenantAssignmentId) || !isNonEmptyString(session.propertyId) || !isNonEmptyString(session.unitId)) {
    return false;
  }

  try {
    const assignment = await prisma.tenantAssignment.findUnique({
      where: { id: session.tenantAssignmentId },
      select: {
        propertyId: true,
        unitId: true,
        isCurrent: true,
        moveOutDate: true,
        unit: { select: { id: true, propertyId: true } },
      },
    });

    return Boolean(
      assignment &&
      assignment.propertyId === session.propertyId &&
      assignment.unitId === session.unitId &&
      assignment.isCurrent &&
      (assignment.moveOutDate === null || assignment.moveOutDate > new Date()) &&
      assignment.unit &&
      assignment.unit.id === session.unitId &&
      assignment.unit.propertyId === session.propertyId
    );
  } catch (error) {
    if (options.strictAuthority) throw error;
    return false;
  }
}

async function hasCurrentAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {
  if (session.role === "ADMIN") {
    if (!isNonEmptyString(session.adminAccessId)) return false;
    try {
      const access = await prisma.adminAccess.findUnique({
        where: { id: session.adminAccessId },
        select: { id: true, isActive: true },
      });
      return Boolean(access && access.isActive === true);
    } catch (error) {
      if (options.strictAuthority) throw error;
      return false;
    }
  }
  if (session.role === "MAINTENANCE") {
    if (!isNonEmptyString(session.maintenanceUserId) || !isNonEmptyString(session.propertyId)) return false;
    try {
      const worker = await prisma.maintenanceUser.findUnique({
        where: { id: session.maintenanceUserId },
        select: { id: true, isActive: true, propertyId: true },
      });
      return Boolean(worker && worker.isActive === true && worker.propertyId === session.propertyId);
    } catch (error) {
      if (options.strictAuthority) throw error;
      return false;
    }
  }
  if (session.role === "OWNER" || session.role === "MANAGER" || session.role === "STAFF") {
    return hasCurrentManagementAuthority(session, options);
  }
  if (session.role === "TENANT") return hasCurrentTenantAuthority(session, options);
  return false;
}

export async function validateSessionToken(token: string, options: SessionValidationOptions = {}): Promise<SessionPayload | null> {
  const session = verifySessionToken(token);
  return session && await hasCurrentAuthority(session, options) ? session : null;
}

export async function getSession(options: SessionValidationOptions = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return token ? validateSessionToken(token, options) : null;
}

export async function requireSession(options: SessionValidationOptions = {}) {
  const session = await getSession(options);

  if (!session) {
    throw new SessionAuthorizationError(401);
  }

  return session;
}

export async function requireRole(role: SessionRole, options: SessionValidationOptions = {}) {
  const session = await requireSession(options);

  if (session.role !== role) {
    throw new SessionAuthorizationError(403);
  }

  return session;
}

export async function requireManagementSession() {
  const session = await requireSession();

  if (
    session.role !== "OWNER" &&
    session.role !== "MANAGER" &&
    session.role !== "STAFF"
  ) {
    throw new Error("Forbidden");
  }

  return session;
}

export async function requireManagerLevelSession() {
  const session = await requireSession();

  if (session.role !== "OWNER" && session.role !== "MANAGER") {
    throw new Error("Forbidden");
  }

  return session;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set("rf_admin_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function refreshSessionCookie(session: SessionPayload, options: SessionValidationOptions = {}) {
  let refreshedToken: string;

  if (session.role === "ADMIN") {
    if (!(await hasCurrentAuthority(session, options))) {
      throw new SessionAuthorizationError(401);
    }
    refreshedToken = createSessionToken({
      role: "ADMIN",
      adminAccessId: session.adminAccessId!,
    });
  } else if (
    session.role === "OWNER" ||
    session.role === "MANAGER" ||
    session.role === "STAFF"
  ) {
    if (!session.propertyId || !session.managementUserId) return;

    if (!(await hasCurrentManagementAuthority(session, options))) {
      throw new SessionAuthorizationError(401);
    }

    refreshedToken = createSessionToken({
      role: session.role,
      propertyId: session.propertyId,
      managementUserId: session.managementUserId,
      managementCredentialBinding: session.managementCredentialBinding!,
    });
  } else if (session.role === "TENANT") {
    if (!session.propertyId || !session.unitId || !session.tenantAssignmentId || !(await hasCurrentTenantAuthority(session, options))) {
      throw new SessionAuthorizationError(401);
    }

    refreshedToken = createSessionToken({
      role: "TENANT",
      propertyId: session.propertyId,
      unitId: session.unitId,
      tenantAssignmentId: session.tenantAssignmentId,
    });
  } else {
    if (!(await hasCurrentAuthority(session, options))) {
      throw new SessionAuthorizationError(401);
    }
    if (!session.propertyId || !session.maintenanceUserId) return;

    refreshedToken = createSessionToken({
      role: "MAINTENANCE",
      propertyId: session.propertyId,
      maintenanceUserId: session.maintenanceUserId,
    });
  }

  await setSessionCookie(refreshedToken);
}
