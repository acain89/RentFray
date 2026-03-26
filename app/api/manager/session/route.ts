import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { canManagerOperate } from "@/lib/liveGating";

const ALLOWED_MANAGEMENT_ROLES = new Set(["OWNER", "MANAGER", "STAFF"]);

type LoginBody = {
  username?: string;
  email?: string;
  password?: string;
  propertyCode?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;

    const propertyCode = clean(body.propertyCode);
    const username = clean(body.username);
    const email = clean(body.email).toLowerCase();
    const password = clean(body.password);

    const loginIdentifier = username || email;

    if (!propertyCode || propertyCode.length !== 4) {
      return NextResponse.json({ error: "Invalid login." }, { status: 400 });
    }

    if (!loginIdentifier || !password) {
      return NextResponse.json({ error: "Invalid login." }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { propertyCode },
      select: {
        id: true,
        isActive: true,
        status: true,
      },
    });

    if (!property || !property.isActive) {
      return NextResponse.json({ error: "Invalid login." }, { status: 401 });
    }

    if (!canManagerOperate(property)) {
      return NextResponse.json(
        { error: "Property not available." },
        { status: 403 }
      );
    }

    const user = await prisma.managementUser.findFirst({
      where: {
        propertyId: property.id,
        isActive: true,
        role: {
          in: ["OWNER", "MANAGER", "STAFF"],
        },
        OR: [
          username
            ? {
                username: username,
              }
            : undefined,
          email
            ? {
                email: email,
              }
            : undefined,
        ].filter(
          (
            clause
          ): clause is
            | { username: string }
            | { email: string } => Boolean(clause)
        ),
      },
      select: {
        id: true,
        role: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive || !ALLOWED_MANAGEMENT_ROLES.has(user.role)) {
      return NextResponse.json({ error: "Invalid login." }, { status: 401 });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return NextResponse.json({ error: "Invalid login." }, { status: 401 });
    }

    const token = createSessionToken({
      role: user.role,
      propertyId: property.id,
      managementUserId: user.id,
    });

    await setSessionCookie(token);

    await prisma.managementUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      role: user.role,
    });
  } catch (error) {
    console.error("POST /api/manager/session failed", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}