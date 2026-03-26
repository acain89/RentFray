import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TierBody = {
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isPrismaKnownError(
  err: unknown
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

/* =========================
   CREATE TIER (NEW)
========================= */
export async function POST(req: Request, context: RouteContext) {
  try {
    const { id: propertyId } = await context.params;

    if (!propertyId) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as TierBody;

    const name = safeString(body.name);
    const baseRent = toNumber(body.baseRent, 0);
    const processingFee = toNumber(body.processingFee, 0);
    const rentDueDay = toNumber(body.rentDueDay, 1);
    const gracePeriodDays = toNumber(body.gracePeriodDays, 0);
    const lateFeeInitial = toNumber(body.lateFeeInitial, 0);
    const lateFeeDaily = toNumber(body.lateFeeDaily, 0);
    const lateFeeMaxDays = toNumber(body.lateFeeMaxDays, 0);

    if (!name) {
      return NextResponse.json(
        { error: "Tier name is required." },
        { status: 400 }
      );
    }

    const created = await prisma.propertyTier.create({
      data: {
        propertyId,
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
      },
    });

    return NextResponse.json({
      ok: true,
      tier: created,
    });
  } catch (error: unknown) {
    console.error("POST tier failed", error);
    return NextResponse.json(
      { error: "Failed to create tier." },
      { status: 500 }
    );
  }
}

/* =========================
   UPDATE TIER (EXISTING)
========================= */
export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id: propertyId } = await context.params;

    if (!propertyId) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as TierBody;

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

    const existingTier = await prisma.propertyTier.findFirst({
      where: { id: tierId, propertyId },
      select: { id: true },
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
            units: { select: { id: true } },
          },
        });

        await tx.unit.updateMany({
          where: { propertyId, tierId },
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
        ...updated,
        lateFeeMaxDays: updated.maxLateFeeDays,
      },
    });
  } catch (error: unknown) {
    if (isPrismaKnownError(error)) {
      console.error("PATCH tier prisma error", error);
    } else {
      console.error("PATCH tier failed", error);
    }

    return NextResponse.json(
      { error: "Failed to update tier." },
      { status: 500 }
    );
  }
}