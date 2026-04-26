import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/pin";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { canActivateUnit } from "@/lib/propertyCapacity";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ActivateBody = {
  propertyCode: string;
  firstName: string;
  lastName: string;
  unitNumber: string;
  confirmUnitNumber: string;
  tierId: string;
  pin: string;
  confirmPin: string;
};

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
    const tierId = clean(body.tierId);
    const pin = clean(body.pin);
    const confirmPin = clean(body.confirmPin);

    if (!/^\d{4,5}$/.test(propertyCode)) {
      return NextResponse.json({ error: "Invalid property code." }, { status: 400 });
    }

    if (!firstName) {
      return NextResponse.json({ error: "First name required." }, { status: 400 });
    }

    if (!lastName) {
      return NextResponse.json({ error: "Last name required." }, { status: 400 });
    }

    if (!unitNumber) {
      return NextResponse.json({ error: "Unit number required." }, { status: 400 });
    }

    if (unitNumber !== confirmUnitNumber) {
      return NextResponse.json({ error: "Unit numbers do not match." }, { status: 400 });
    }

    if (!tierId) {
      return NextResponse.json({ error: "Tier selection required." }, { status: 400 });
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be 4 digits." }, { status: 400 });
    }

    if (pin !== confirmPin) {
      return NextResponse.json({ error: "PINs do not match." }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
  where: { propertyCode },
  select: {
    id: true,
    isActive: true,
    unitCount: true,
    tiers: {
      where: { id: tierId, isActive: true },
      select: {
  id: true,
  baseRentCents: true,
  rentDueDay: true,
  lateFeeInitialCents: true,
  lateFeeDailyCents: true,
  maxLateFeeDays: true,
  gracePeriodDays: true,
     },
    },
  },
});

    if (!property || !property.isActive) {
      return NextResponse.json({ error: "Property not available." }, { status: 403 });
    }

    const selectedTier = property.tiers[0] ?? null;

    if (!selectedTier) {
      return NextResponse.json({ error: "Invalid tier selection." }, { status: 400 });
    }

    const existingUnit = await prisma.unit.findUnique({
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

    if (existingUnit && !existingUnit.isActive) {
      return NextResponse.json({ error: "This unit is inactive." }, { status: 400 });
    }

    if (existingUnit?.portalActivated) {
      return NextResponse.json(
        {
          error:
            "This unit has already been activated. Please use Tenant login or contact the office.",
        },
        { status: 400 }
      );
    }

    /**
     * 🔒 HARD CAPACITY GUARD
     * Only block if creating NEW active unit
     */
    if (!existingUnit) {
  const canActivate = await canActivateUnit(property.id);

  if (!canActivate) {
    return NextResponse.json(
      { error: "Property is at full capacity. Contact management." },
      { status: 409 }
    );
  }
}

    const pinHash = await hashPin(pin);
    const activatedAt = new Date();

    const savedUnit = existingUnit
      ? await prisma.unit.update({
          where: { id: existingUnit.id },
          data: {
            tierId: selectedTier.id,
            portalActivated: true,
            portalFirstName: firstName,
            portalLastName: lastName,
            tenantPinHash: pinHash,
            activatedAt,
            activationSource: "SELF_SERVICE",
          },
          select: { id: true },
        })
      : await prisma.unit.create({
          data: {
            propertyId: property.id,
            unitNumber,
            tierId: selectedTier.id,
            isActive: true,
            portalActivated: true,
            portalFirstName: firstName,
            portalLastName: lastName,
            tenantPinHash: pinHash,
            activatedAt,
            activationSource: "SELF_SERVICE",
          },
          select: { id: true },
        });

    const billingCycle = new Date().toISOString().slice(0, 7);

    const tenantAssignment = await prisma.tenantAssignment.create({
      data: {
        propertyId: property.id,
        unitId: savedUnit.id,
        firstName,
        lastName,
        isCurrent: true,
        moveInDate: new Date(),
      },
      select: { id: true },
    });

    await prisma.ledgerEntry.create({
      data: {
        propertyId: property.id,
        unitId: savedUnit.id,
        tenantAssignmentId: tenantAssignment.id,
        entryType: "CHARGE",
        chargeType: "RENT",
        amountCents: selectedTier.baseRentCents,
        effectiveDate: new Date(),
        billingCycle,
        memo: "Base Rent",
      },
    });

// 🔥 LATE FEE CATCH-UP (activation after due date)

const now = new Date();

// You already have rentDates system — reuse it
const { getRentDateSummary, resolveEffectiveBillingSettings } = await import("@/lib/rentDates");

const propertyWithSettings = await prisma.property.findUnique({
  where: { id: property.id },
  include: { settings: true },
});

if (propertyWithSettings?.settings) {
 const effective = resolveEffectiveBillingSettings({
  tier: selectedTier,
  propertySettings: propertyWithSettings.settings,
});

  const rentDates = getRentDateSummary({
    ...effective,
    now,
  });

  const graceEnd = new Date(`${rentDates.graceEndsOn}T00:00:00`);

  if (graceEnd && now > graceEnd) {
    const daysLate = Math.floor(
      (now.getTime() - graceEnd.getTime()) / (1000 * 60 * 60 * 24)
    );

    const maxDays = effective.maxLateFeeDays ?? 0;
    const applicableDays = Math.min(daysLate, maxDays);

    // Initial late fee (once)
    if (effective.lateFeeInitialCents > 0) {
      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: savedUnit.id,
          tenantAssignmentId: tenantAssignment.id,
          entryType: "CHARGE",
          chargeType: "LATE_FEE_INITIAL",
          amountCents: effective.lateFeeInitialCents,
          effectiveDate: now,
          billingCycle,
          memo: "Initial late fee",
        },
      });
    }

    // Daily late fees
    for (let i = 1; i <= applicableDays; i++) {
      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: savedUnit.id,
          tenantAssignmentId: tenantAssignment.id,
          entryType: "CHARGE",
          chargeType: "LATE_FEE_DAILY",
          amountCents: effective.lateFeeDailyCents,
          effectiveDate: new Date(graceEnd.getTime() + i * 86400000),
          billingCycle,
          memo: `Daily late fee for ${feeDate.toISOString().slice(0,10)}`
        },
      });
    }
  }
}

    const token = createSessionToken({
      role: "TENANT",
      propertyId: property.id,
      unitId: savedUnit.id,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      role: "TENANT",
      propertyId: property.id,
      unitId: savedUnit.id,
    });
  } catch (error: unknown) {
    console.error("POST /api/tenant/activate failed", error);

    return NextResponse.json({ error: "Activation failed." }, { status: 500 });
  }
}
