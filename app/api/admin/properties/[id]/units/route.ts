// app/api/admin/properties/[id]/units/route.ts

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UnitPostBody = {
  tierId?: unknown;
  unitNumber?: unknown;
  baseRent?: unknown;
};

type UnitPatchBody = {
  unitId?: unknown;
  unitNumber?: unknown;
  baseRent?: unknown;
};

type UnitDeleteBody = {
  unitId?: unknown;
};

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isPrismaKnownError(
  err: unknown
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

async function getProperty(propertyId: string) {
  return prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
}

async function getTier(propertyId: string, tierId: string) {
  return prisma.propertyTier.findFirst({
    where: {
      id: tierId,
      propertyId,
    },
    select: {
      id: true,
      propertyId: true,
      name: true,
      baseRent: true,
      recurringFeeTotal: true as never,
    } as never,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    if (!propertyId) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    const property = await getProperty(propertyId);

    if (!property) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as UnitPostBody;

    const tierId = safeString(body.tierId);
    const unitNumber = safeString(body.unitNumber).toUpperCase();
    const baseRent = toNumber(body.baseRent, 0);

    if (!tierId) {
      return NextResponse.json(
        { error: "Tier id is required." },
        { status: 400 }
      );
    }

    if (!unitNumber) {
      return NextResponse.json(
        { error: "Unit number is required." },
        { status: 400 }
      );
    }

    if (baseRent < 0) {
      return NextResponse.json(
        { error: "Base rent must be 0 or greater." },
        { status: 400 }
      );
    }

    const tier = await prisma.propertyTier.findFirst({
      where: {
        id: tierId,
        propertyId,
      },
      select: {
        id: true,
        propertyId: true,
        name: true,
        baseRent: true,
      },
    });

    if (!tier) {
      return NextResponse.json(
        { error: "Tier not found for this property." },
        { status: 404 }
      );
    }

    const existingUnit = await prisma.unit.findFirst({
      where: {
        propertyId,
        unitNumber,
      },
      select: { id: true },
    });

    if (existingUnit) {
      return NextResponse.json(
        { error: "That unit number already exists for this property." },
        { status: 409 }
      );
    }

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const unit = await tx.unit.create({
        data: {
          propertyId,
          tierId,
          unitNumber,
          unitType: tier.name,
          baseRent,
          recurringFees: 0,
          isActive: true,
        },
        select: {
          id: true,
          propertyId: true,
          tierId: true,
          unitNumber: true,
          unitType: true,
          baseRent: true,
          recurringFees: true,
          isActive: true,
        },
      });

      const tierUnitCount = await tx.unit.count({
        where: {
          propertyId,
          tierId,
        },
      });

      await tx.propertyTier.update({
        where: { id: tierId },
        data: {
          unitCount: tierUnitCount,
        },
      });

      return {
        ...unit,
        unitCount: tierUnitCount,
      };
    });

    return NextResponse.json({
      ok: true,
      unit: created,
    });
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.error("POST /api/admin/properties/[id]/units prisma error", error);
    } else {
      console.error("POST /api/admin/properties/[id]/units failed", error);
    }

    return NextResponse.json(
      { error: "Failed to create unit." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    if (!propertyId) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    const property = await getProperty(propertyId);

    if (!property) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as UnitPatchBody;

    const unitId = safeString(body.unitId);
    const unitNumber = safeString(body.unitNumber).toUpperCase();
    const baseRent = toNumber(body.baseRent, 0);

    if (!unitId) {
      return NextResponse.json(
        { error: "Unit id is required." },
        { status: 400 }
      );
    }

    if (!unitNumber) {
      return NextResponse.json(
        { error: "Unit number is required." },
        { status: 400 }
      );
    }

    if (baseRent < 0) {
      return NextResponse.json(
        { error: "Base rent must be 0 or greater." },
        { status: 400 }
      );
    }

    const existingUnit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        propertyId,
      },
      select: {
        id: true,
        propertyId: true,
        tierId: true,
      },
    });

    if (!existingUnit) {
      return NextResponse.json(
        { error: "Unit not found for this property." },
        { status: 404 }
      );
    }

    const duplicateUnit = await prisma.unit.findFirst({
      where: {
        propertyId,
        unitNumber,
        NOT: {
          id: unitId,
        },
      },
      select: { id: true },
    });

    if (duplicateUnit) {
      return NextResponse.json(
        { error: "That unit number already exists for this property." },
        { status: 409 }
      );
    }

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data: {
        unitNumber,
        baseRent,
      },
      select: {
        id: true,
        propertyId: true,
        tierId: true,
        unitNumber: true,
        unitType: true,
        baseRent: true,
        recurringFees: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      unit: updated,
    });
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.error("PATCH /api/admin/properties/[id]/units prisma error", error);
    } else {
      console.error("PATCH /api/admin/properties/[id]/units failed", error);
    }

    return NextResponse.json(
      { error: "Failed to update unit." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    if (!propertyId) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    const property = await getProperty(propertyId);

    if (!property) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as UnitDeleteBody;
    const unitId = safeString(body.unitId);

    if (!unitId) {
      return NextResponse.json(
        { error: "Unit id is required." },
        { status: 400 }
      );
    }

    const existingUnit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        propertyId,
      },
      select: {
        id: true,
        tierId: true,
        assignments: {
          where: { moveOut: null },
          select: { id: true },
        },
      },
    });

    if (!existingUnit) {
      return NextResponse.json(
        { error: "Unit not found for this property." },
        { status: 404 }
      );
    }

    if (existingUnit.assignments.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete a unit with an active assignment." },
        { status: 409 }
      );
    }

    const deleted = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.unitRecurringFee.deleteMany({
        where: { unitId },
      });

      await tx.unit.delete({
        where: { id: unitId },
      });

      const tierUnitCount = await tx.unit.count({
        where: {
          propertyId,
          tierId: existingUnit.tierId,
        },
      });

      await tx.propertyTier.update({
        where: { id: existingUnit.tierId },
        data: {
          unitCount: tierUnitCount,
        },
      });

      return {
        unitId,
        tierId: existingUnit.tierId,
        unitCount: tierUnitCount,
      };
    });

    return NextResponse.json({
      ok: true,
      deleted,
    });
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.error("DELETE /api/admin/properties/[id]/units prisma error", error);
    } else {
      console.error("DELETE /api/admin/properties/[id]/units failed", error);
    }

    return NextResponse.json(
      { error: "Failed to delete unit." },
      { status: 500 }
    );
  }
}