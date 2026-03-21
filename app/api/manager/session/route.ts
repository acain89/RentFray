// app/api/manager/session/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { canManagerOperate } from "@/lib/liveGating";

const ALLOWED_MANAGEMENT_ROLES = new Set(["OWNER", "MANAGER", "STAFF"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyCode = String(body.propertyCode || "").trim();
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    if (!propertyCode || propertyCode.length !== 4) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 400 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 400 }
      );
    }

    const property = await prisma.property.findUnique({
      where: { propertyCode },
      select: {
        id: true,
        status: true,
        isActive: true,
      },
    });

    if (!property || !property.isActive) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    // ✅ CENTRALIZED GATING
    if (!canManagerOperate(property)) {
      return NextResponse.json(
        { error: "Property not available." },
        { status: 403 }
      );
    }

    const user = await prisma.managementUser.findUnique({
      where: {
        propertyId_username: {
          propertyId: property.id,
          username,
        },
      },
      select: {
        id: true,
        role: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive || !ALLOWED_MANAGEMENT_ROLES.has(user.role)) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      role: user.role,
      propertyId: property.id,
      managementUserId: user.id,
    });

    await setSessionCookie(token);

    await prisma.managementUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      role: user.role,
      propertyId: property.id,
    });
  } catch (error) {
    console.error("POST /api/manager/session failed", error);

    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 }
    );
  }
}