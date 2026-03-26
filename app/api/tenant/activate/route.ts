import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/pin";
import { createSessionToken, setSessionCookie } from "@/lib/session";

type ActivateBody = {
  propertyCode: string;
  firstName: string;
  lastName: string;
  unitNumber: string;
  confirmUnitNumber: string;
  pin: string;
  confirmPin: string;
};

const ALLOWED_PROPERTY_STATUSES: Set<string> = new Set([
  "TEST",
  "READY",
  "LIVE",
]);

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ActivateBody>;

    const propertyCode = clean(body.propertyCode);
    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    const unitNumber = clean(body.unitNumber).toUpperCase();
    const confirmUnitNumber = clean(body.confirmUnitNumber).toUpperCase();
    const pin = clean(body.pin);
    const confirmPin = clean(body.confirmPin);

    // 🔒 PROPERTY CODE VALIDATION (4 OR 5 DIGITS)
    if (!/^\d{4,5}$/.test(propertyCode)) {
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

    // 🔍 PROPERTY LOOKUP
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

    // 🔍 UNIT LOOKUP
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

    // 🔐 HASH PIN
    const pinHash = await hashPin(pin);

    // 🧠 ACTIVATE UNIT
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

    // 🧾 AUDIT LOG
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

    // 🍪 SESSION
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
  } catch (error: unknown) {
    console.error("POST /api/tenant/activate failed", error);

    return NextResponse.json(
      { error: "Activation failed." },
      { status: 500 }
    );
  }
}