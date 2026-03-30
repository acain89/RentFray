// app/api/tenant/session/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/pin";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import {
  checkPinAllowed,
  recordFailedAttempt,
  clearPinAttempts,
} from "@/lib/pinLockout";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyCode = String(body.propertyCode || "").trim();
    const unitNumber = String(body.unitNumber || "").trim().toUpperCase();
    const pin = String(body.pin || "").trim();

    if (!propertyCode || propertyCode.length !== 4) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 400 }
      );
    }

    if (!unitNumber) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 400 }
      );
    }

    const property = await prisma.property.findUnique({
      where: { propertyCode },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!property || !property.isActive) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    const unit = await prisma.unit.findUnique({
      where: {
        propertyId_unitNumber: {
          propertyId: property.id,
          unitNumber,
        },
      },
      select: {
        id: true,
        isActive: true,
        portalActivated: true,
        tenantPinHash: true,
      },
    });

    if (!unit || !unit.isActive) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    if (!unit.portalActivated || !unit.tenantPinHash) {
      return NextResponse.json(
        { error: "Unit not activated." },
        { status: 400 }
      );
    }

    const allowed = await checkPinAllowed(unit.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const valid = await verifyPin(pin, unit.tenantPinHash);

    if (!valid) {
      await recordFailedAttempt(unit.id);
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    await clearPinAttempts(unit.id);

    const token = createSessionToken({
      role: "TENANT",
      propertyId: property.id,
      unitId: unit.id,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      role: "TENANT",
      propertyId: property.id,
      unitId: unit.id,
    });
  } catch (error) {
    console.error("POST /api/tenant/session failed", error);

    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 }
    );
  }
}