// app/api/admin/properties/[id]/tiers/route.ts

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TierPatchBody = {
  tierId?: unknown;
  name?: unknown;
  baseRent?: unknown;
  processingFee?: unknown;
  rentDueDay?: unknown;
  gracePeriodDays?: unknown;
  lateFeeInitial?: unknown;
  lateFeeDaily?: unknown;
  lateFeeMaxDays?: unknown;
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

    const body = (await req.json()) as TierPatchBody;

    const tierId = safeString(body.tierId);
    const name = safeString(body.name);
    const baseRent = toNumber(body.baseRent, 0);
    const processingFee = toNumber(body.processingFee, 0);
    const rentDueDay = toNumber(body.rentDueDay, 1);
    const gracePeriodDays = toNumber(body.gracePeriodDays, 0);
    const lateFeeInitial = toNumber(body.lateFeeInitial, 0);
    const lateFeeDaily = toNumber(body.lateFeeDaily, 0);
    const lateFeeMaxDays = toNumber(body.lateFeeMaxDays, 0);

    if (!tierId) {
      return NextResponse.json(
        { error: "Tier id is required." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Tier name is required." },
        { status: 400 }
      );
    }

    if (baseRent < 0) {
      return NextResponse.json(
        { error: "Base rent must be 0 or greater." },
        { status: 400 }
      );
    }

    if (processingFee < 0) {
      return NextResponse.json(
        { error: "Processing fee must be 0 or greater." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 31) {
      return NextResponse.json(
        { error: "Due day must be between 1 and 31." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(gracePeriodDays) ||
      gracePeriodDays < 0 ||
      gracePeriodDays > 31
    ) {
      return NextResponse.json(
        { error: "Grace period must be between 0 and 31 days." },
        { status: 400 }
      );
    }

    if (lateFeeInitial < 0) {
      return NextResponse.json(
        { error: "Initial late fee must be 0 or greater." },
        { status: 400 }
      );
    }

    if (lateFeeDaily < 0) {
      return NextResponse.json(
        { error: "Daily late fee must be 0 or greater." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(lateFeeMaxDays) ||
      lateFeeMaxDays < 0 ||
      lateFeeMaxDays > 31
    ) {
      return NextResponse.json(
        { error: "Max daily late fee days must be between 0 and 31." },
        { status: 400 }
      );
    }

    const existingTier = await prisma.propertyTier.findFirst({
      where: {
        id: tierId,
        propertyId,
      },
      select: {
        id: true,
        propertyId: true,
      },
    });

    if (!existingTier) {
      return NextResponse.json(
        { error: "Tier not found for this property." },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const tier = await tx.propertyTier.update({
          where: { id: tierId },
          data: {
            name,
            baseRent,
            processingFee,
            rentDueDay,
            gracePeriodDays,
            lateFeeInitial,
            lateFeeDaily,
            maxLateFeeDays: lateFeeMaxDays,
          },
          select: {
            id: true,
            propertyId: true,
            name: true,
            baseRent: true,
            processingFee: true,
            rentDueDay: true,
            gracePeriodDays: true,
            lateFeeInitial: true,
            lateFeeDaily: true,
            maxLateFeeDays: true,
            units: {
              select: {
                id: true,
              },
            },
          },
        });

        await tx.unit.updateMany({
          where: {
            propertyId,
            tierId,
          },
          data: {
            unitType: name,
            baseRent,
          },
        });

        return {
          ...tier,
          unitCount: tier.units.length,
        };
      }
    );

    return NextResponse.json({
      ok: true,
      tier: {
        id: updated.id,
        propertyId: updated.propertyId,
        name: updated.name,
        baseRent: updated.baseRent,
        processingFee: updated.processingFee,
        rentDueDay: updated.rentDueDay,
        gracePeriodDays: updated.gracePeriodDays,
        lateFeeInitial: updated.lateFeeInitial,
        lateFeeDaily: updated.lateFeeDaily,
        lateFeeMaxDays: updated.maxLateFeeDays,
        unitCount: updated.unitCount,
      },
    });
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.error("PATCH /api/admin/properties/[id]/tiers prisma error", error);
    } else {
      console.error("PATCH /api/admin/properties/[id]/tiers failed", error);
    }

    return NextResponse.json(
      { error: "Failed to update tier." },
      { status: 500 }
    );
  }
}