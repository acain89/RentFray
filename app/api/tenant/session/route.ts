// app/api/tenant/session/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/pin";
import { createSessionToken, setSessionCookie } from "@/lib/session";

const ALLOWED_PROPERTY_STATUSES = new Set(["TEST", "READY", "LIVE"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyCode = String(body.propertyCode || "").trim();
    const unitNumber = String(body.unitNumber || "").trim().toUpperCase();
    const pin = String(body.pin || "").trim();

    if (!propertyCode || propertyCode.length !== 4) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 400 }
      );
    }

    if (!unitNumber) {
      return NextResponse.json(
        { error: "Unit number required." },
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
        { error: "Unit not found." },
        { status: 404 }
      );
    }

    if (!unit.portalActivated || !unit.tenantPinHash) {
      return NextResponse.json(
        {
          error:
            "This unit has not been activated yet. Please use Tenant First Time Use or contact the office.",
        },
        { status: 400 }
      );
    }

    const valid = await verifyPin(pin, unit.tenantPinHash);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

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