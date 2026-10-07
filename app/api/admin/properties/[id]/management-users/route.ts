import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type CreateBody = {
  email?: unknown;
  password?: unknown;
  role?: unknown;
};

type UpdateBody = {
  userId?: unknown;
  role?: unknown;
  isActive?: unknown;
};

type ManagementUserRole = "MANAGER" | "STAFF";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeRole(value: unknown, fallback: ManagementUserRole): ManagementUserRole | null {
  const role = clean(value).toUpperCase();

  if (role === "MANAGER" || role === "STAFF") {
    return role;
  }

  return value === undefined ? fallback : null;
}

/* =========================
   GET — LIST USERS
========================= */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

if (
  !session ||
  !session.propertyId ||
  !["OWNER", "MANAGER", "STAFF"].includes(session.role)
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

  const { id: propertyId } = await params;

   if (session.propertyId !== propertyId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

  const users = await prisma.managementUser.findMany({
    where: { propertyId },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ok: true, users });
}

/* =========================
   POST — CREATE USER
========================= */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

  if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: propertyId } = await params;

  if (!session.propertyId || session.propertyId !== propertyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as CreateBody;

  const email = clean(body.email).toLowerCase();
  const username = email;
  const password = clean(body.password);
  const role = normalizeRole(body.role, "STAFF");
  if (!role) {
    return NextResponse.json({ error: "Role must be MANAGER or STAFF." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const existing = await prisma.managementUser.findFirst({
    where: {
      propertyId,
      OR: [{ email }, { username }],
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A management user with that email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.managementUser.create({
    data: {
      propertyId,
      email,
      username,
      passwordHash,
      role,
      createdByUserId: session.managementUserId,
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  let verificationEmailSent = true;
  let propertyCode = "";
  try {
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { propertyCode: true } });
    propertyCode = property?.propertyCode ?? "";
    await sendVerificationEmail({ managementUserId: created.id, email, propertyCode });
  } catch (error) {
    verificationEmailSent = false;
    console.error("Management user created; verification email failed:", error);
  }
  const verificationRecoveryUrl = `/verify-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(propertyCode)}&sent=${verificationEmailSent ? "1" : "0"}`;
  return NextResponse.json({ ok: true, user: created, verificationEmailSent, verificationRecoveryUrl });
}

/* =========================
   PATCH — UPDATE USER
========================= */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

  if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: propertyId } = await params;

  if (!session.propertyId || session.propertyId !== propertyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as UpdateBody;

  const userId = clean(body.userId);
  const data: { role?: ManagementUserRole; isActive?: boolean } = {};
  if (Object.prototype.hasOwnProperty.call(body, "role")) {
    const role = typeof body.role === "string" ? normalizeRole(body.role, "STAFF") : null;
    if (!role) {
      return NextResponse.json({ error: "Role must be MANAGER or STAFF." }, { status: 400 });
    }
    data.role = role;
  }
  if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
    }
    data.isActive = body.isActive;
  }

  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No supported fields to update." }, { status: 400 });
  }

  const existing = await prisma.managementUser.findFirst({
    where: { id: userId, propertyId },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (existing.role === "OWNER") {
    return NextResponse.json(
      { error: "Owner cannot be modified or disabled." },
      { status: 403 }
    );
  }

  const updated = await prisma.managementUser.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}
