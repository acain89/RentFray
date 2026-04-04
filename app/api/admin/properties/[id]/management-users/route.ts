import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

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

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function toBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

/* =========================
   GET — LIST USERS
========================= */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: propertyId } = await params;

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

  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: propertyId } = await params;
  const body = (await req.json()) as CreateBody;

  const email = clean(body.email).toLowerCase();
  const password = clean(body.password);
  const role = clean(body.role || "STAFF");

  if (!email || !password) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.managementUser.create({
    data: {
      propertyId,
      email,
      passwordHash,
      role,
      createdByUserId: session.managementUserId,
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, user: created });
}

/* =========================
   PATCH — UPDATE USER
========================= */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();

  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: propertyId } = await params;
  const body = (await req.json()) as UpdateBody;

  const userId = clean(body.userId);
  const role = clean(body.role);
  const isActive = toBoolean(body.isActive, true);

  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  const existing = await prisma.managementUser.findFirst({
    where: { id: userId, propertyId },
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
    data: {
      role: role || existing.role,
      isActive,
    },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}