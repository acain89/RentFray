// app/api/tenant/activate/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/pin";
import { createSessionToken, setSessionCookie } from "@/lib/session";

const ALLOWED_PROPERTY_STATUSES = new Set(["TEST", "READY", "LIVE"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyCode = String(body.propertyCode || "").trim();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const unitNumber = String(body.unitNumber || "").trim().toUpperCase();
    const confirmUnitNumber = String(body.confirmUnitNumber || "")
      .trim()
      .toUpperCase();
    const pin = String(body.pin || "").trim();
    const confirmPin = String(body.confirmPin || "").trim();

    if (!propertyCode || propertyCode.length !== 4) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 400 }
      );
    }

    if (!firstName) {
      return NextResponse.json(
        { error: "First name required." },
        { status: 400 }
      );
    }

    if (!lastName) {
      return NextResponse.json(
        { error: "Last name required." },
        { status: 400 }
      );
    }

    if (!unitNumber) {
      return NextResponse.json(
        { error: "Unit number required." },
        { status: 400 }
      );
    }

    if (unitNumber !== confirmUnitNumber) {
      return NextResponse.json(
        { error: "Unit numbers do not match." },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 digits." },
        { status: 400 }
      );
    }

    if (pin !== confirmPin) {
      return NextResponse.json(
        { error: "PINs do not match." },
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
      },
    });

    if (!unit || !unit.isActive) {
      return NextResponse.json(
        { error: "Invalid unit number." },
        { status: 404 }
      );
    }

    if (unit.portalActivated) {
      return NextResponse.json(
        {
          error:
            "This unit has already been activated. Please use Tenant login or contact the office.",
        },
        { status: 400 }
      );
    }

    const pinHash = await hashPin(pin);

    await prisma.unit.update({
      where: { id: unit.id },
      data: {
        portalActivated: true,
        portalFirstName: firstName,
        portalLastName: lastName,
        tenantPinHash: pinHash,
        activatedAt: new Date(),
        activationSource: "SELF_SERVICE",
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: property.id,
        actorType: "TENANT",
        action: "TENANT_PORTAL_ACTIVATED",
        targetType: "Unit",
        targetId: unit.id,
        summary: `Tenant portal activated for unit ${unitNumber}.`,
        metadataJson: JSON.stringify({
          unitNumber,
          firstName,
          lastName,
          activationSource: "SELF_SERVICE",
        }),
      },
    });

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
    console.error("POST /api/tenant/activate failed", error);

    return NextResponse.json(
      { error: "Activation failed." },
      { status: 500 }
    );
  }
}