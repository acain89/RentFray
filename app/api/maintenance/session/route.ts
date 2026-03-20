// app/api/maintenance/session/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/session";

const ALLOWED_PROPERTY_STATUSES = new Set(["TEST", "READY", "LIVE"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyCode = String(body.propertyCode || "").trim();
    const pin = String(body.pin || "").trim();

    if (!propertyCode || propertyCode.length !== 4) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "Invalid PIN." },
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
        { error: "Property not found." },
        { status: 404 }
      );
    }

    if (!ALLOWED_PROPERTY_STATUSES.has(property.status)) {
      return NextResponse.json(
        { error: "Property not available." },
        { status: 403 }
      );
    }

    const users = await prisma.maintenanceUser.findMany({
      where: {
        propertyId: property.id,
        isActive: true,
      },
      select: {
        id: true,
        pinHash: true,
      },
    });

    let matchedUserId: string | null = null;

    for (const user of users) {
      const ok = await bcrypt.compare(pin, user.pinHash);
      if (ok) {
        matchedUserId = user.id;
        break;
      }
    }

    if (!matchedUserId) {
      return NextResponse.json(
        { error: "Invalid PIN." },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      role: "MAINTENANCE",
      propertyId: property.id,
      maintenanceUserId: matchedUserId,
    });

    await setSessionCookie(token);

    await prisma.maintenanceUser.update({
      where: { id: matchedUserId },
      data: { lastLoginAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      role: "MAINTENANCE",
      propertyId: property.id,
      maintenanceUserId: matchedUserId,
    });
  } catch (error) {
    console.error("POST /api/maintenance/session failed", error);

    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 }
    );
  }
}