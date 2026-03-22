// app/api/admin/properties/[id]/charges/route.ts

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ChargePostBody = {
  unitId?: unknown;
  label?: unknown;
  amount?: unknown;
};

type ChargePatchBody = {
  chargeId?: unknown;
  label?: unknown;
  amount?: unknown;
};

type ChargeDeleteBody = {
  chargeId?: unknown;
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

async function recalculateUnitRecurringFees(
  tx: Prisma.TransactionClient,
  unitId: string
) {
  const activeFees = await tx.unitRecurringFee.findMany({
    where: {
      unitId,
      isActive: true,
    },
    select: {
      amount: true,
    },
  });

  const recurringFees = activeFees.reduce(
    (sum, fee) => sum + Number(fee.amount || 0),
    0
  );

  await tx.unit.update({
    where: { id: unitId },
    data: {
      recurringFees,
    },
  });

  return recurringFees;
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

    const body = (await req.json()) as ChargePostBody;

    const unitId = safeString(body.unitId);
    const label = safeString(body.label);
    const amount = toNumber(body.amount, 0);

    if (!unitId) {
      return NextResponse.json(
        { error: "Unit id is required." },
        { status: 400 }
      );
    }

    if (!label) {
      return NextResponse.json(
        { error: "Charge label is required." },
        { status: 400 }
      );
    }

    if (amount < 0) {
      return NextResponse.json(
        { error: "Charge amount must be 0 or greater." },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        propertyId,
      },
      select: {
        id: true,
        propertyId: true,
      },
    });

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found for this property." },
        { status: 404 }
      );
    }

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existingCount = await tx.unitRecurringFee.count({
        where: { unitId },
      });

      const charge = await tx.unitRecurringFee.create({
        data: {
          propertyId,
          unitId,
          label,
          amount,
          isActive: true,
          displayOrder: existingCount,
        },
        select: {
          id: true,
          propertyId: true,
          unitId: true,
          label: true,
          amount: true,
          isActive: true,
          displayOrder: true,
        },
      });

      const recurringFees = await recalculateUnitRecurringFees(tx, unitId);

      return {
        ...charge,
        recurringFees,
      };
    });

    return NextResponse.json({
      ok: true,
      charge: created,
    });
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.error(
        "POST /api/admin/properties/[id]/charges prisma error",
        error
      );
    } else {
      console.error("POST /api/admin/properties/[id]/charges failed", error);
    }

    return NextResponse.json(
      { error: "Failed to create charge." },
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

    const body = (await req.json()) as ChargePatchBody;

    const chargeId = safeString(body.chargeId);
    const label = safeString(body.label);
    const amount = toNumber(body.amount, 0);

    if (!chargeId) {
      return NextResponse.json(
        { error: "Charge id is required." },
        { status: 400 }
      );
    }

    if (!label) {
      return NextResponse.json(
        { error: "Charge label is required." },
        { status: 400 }
      );
    }

    if (amount < 0) {
      return NextResponse.json(
        { error: "Charge amount must be 0 or greater." },
        { status: 400 }
      );
    }

    const existingCharge = await prisma.unitRecurringFee.findFirst({
      where: {
        id: chargeId,
        propertyId,
      },
      select: {
        id: true,
        unitId: true,
      },
    });

    if (!existingCharge) {
      return NextResponse.json(
        { error: "Charge not found for this property." },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const charge = await tx.unitRecurringFee.update({
        where: { id: chargeId },
        data: {
          label,
          amount,
        },
        select: {
          id: true,
          propertyId: true,
          unitId: true,
          label: true,
          amount: true,
          isActive: true,
          displayOrder: true,
        },
      });

      const recurringFees = await recalculateUnitRecurringFees(
        tx,
        existingCharge.unitId
      );

      return {
        ...charge,
        recurringFees,
      };
    });

    return NextResponse.json({
      ok: true,
      charge: updated,
    });
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.error(
        "PATCH /api/admin/properties/[id]/charges prisma error",
        error
      );
    } else {
      console.error("PATCH /api/admin/properties/[id]/charges failed", error);
    }

    return NextResponse.json(
      { error: "Failed to update charge." },
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

    const body = (await req.json()) as ChargeDeleteBody;
    const chargeId = safeString(body.chargeId);

    if (!chargeId) {
      return NextResponse.json(
        { error: "Charge id is required." },
        { status: 400 }
      );
    }

    const existingCharge = await prisma.unitRecurringFee.findFirst({
      where: {
        id: chargeId,
        propertyId,
      },
      select: {
        id: true,
        unitId: true,
      },
    });

    if (!existingCharge) {
      return NextResponse.json(
        { error: "Charge not found for this property." },
        { status: 404 }
      );
    }

    const deleted = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.unitRecurringFee.delete({
        where: { id: chargeId },
      });

      const recurringFees = await recalculateUnitRecurringFees(
        tx,
        existingCharge.unitId
      );

      const remainingCharges = await tx.unitRecurringFee.findMany({
        where: { unitId: existingCharge.unitId },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      for (let index = 0; index < remainingCharges.length; index++) {
        await tx.unitRecurringFee.update({
          where: { id: remainingCharges[index].id },
          data: { displayOrder: index },
        });
      }

      return {
        chargeId,
        unitId: existingCharge.unitId,
        recurringFees,
      };
    });

    return NextResponse.json({
      ok: true,
      deleted,
    });
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.error(
        "DELETE /api/admin/properties/[id]/charges prisma error",
        error
      );
    } else {
      console.error("DELETE /api/admin/properties/[id]/charges failed", error);
    }

    return NextResponse.json(
      { error: "Failed to delete charge." },
      { status: 500 }
    );
  }
}