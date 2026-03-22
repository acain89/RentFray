// app/api/admin/properties/[id]/route.ts

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PatchBody = {
  name?: unknown;
  address?: unknown;
  propertyType?: unknown;
  isActive?: unknown;
  rentDueDay?: unknown;
  gracePeriodDays?: unknown;
  lateFeeEnabled?: unknown;
  lateFeeFlat?: unknown;
  convenienceFeeEnabled?: unknown;
  convenienceFeeAmount?: unknown;
};

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function isPrismaKnownError(
  err: unknown
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing property id." }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        propertySettings: true,
        tiers: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            units: {
              orderBy: { unitNumber: "asc" },
              include: {
                recurringFees: {
                  where: { isActive: true },
                  orderBy: { displayOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      property,
    });
  } catch (error) {
    console.error("GET /api/admin/properties/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to load property." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing property id." }, { status: 400 });
    }

    const body = (await req.json()) as PatchBody;

    const name = safeString(body.name);
    const address = safeString(body.address);
    const propertyType = safeString(body.propertyType || "OTHER");
    const isActive = toBoolean(body.isActive, true);

    const rentDueDay = toNumber(body.rentDueDay, 1);
    const gracePeriodDays = toNumber(body.gracePeriodDays, 0);
    const lateFeeEnabled = toBoolean(body.lateFeeEnabled, true);
    const lateFeeFlat = toNumber(body.lateFeeFlat, 0);
    const convenienceFeeEnabled = toBoolean(body.convenienceFeeEnabled, true);
    const convenienceFeeAmount = toNumber(body.convenienceFeeAmount, 0);

    if (!name) {
      return NextResponse.json(
        { error: "Property name is required." },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { error: "Property address is required." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 31) {
      return NextResponse.json(
        { error: "Rent due day must be between 1 and 31." },
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

    if (lateFeeFlat < 0) {
      return NextResponse.json(
        { error: "Late fee cannot be negative." },
        { status: 400 }
      );
    }

    if (convenienceFeeAmount < 0) {
      return NextResponse.json(
        { error: "Convenience fee cannot be negative." },
        { status: 400 }
      );
    }

    const existing = await prisma.property.findUnique({
      where: { id },
      select: { id: true, propertySettings: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const property = await tx.property.update({
        where: { id },
        data: {
          name,
          addressLine1: address,
          propertyType,
          isActive,
        },
        select: {
          id: true,
          name: true,
          propertyCode: true,
          propertyType: true,
          addressLine1: true,
          isActive: true,
        },
      });

      const settings =
        existing.propertySettings
          ? await tx.propertySettings.update({
              where: { propertyId: id },
              data: {
                rentDueDay,
                gracePeriodDays,
                lateFeeEnabled,
                lateFeeFlat,
                convenienceFeeEnabled,
                convenienceFeeAmount,
              },
              select: {
                propertyId: true,
                rentDueDay: true,
                gracePeriodDays: true,
                lateFeeEnabled: true,
                lateFeeFlat: true,
                convenienceFeeEnabled: true,
                convenienceFeeAmount: true,
              },
            })
          : await tx.propertySettings.create({
              data: {
                propertyId: id,
                rentDueDay,
                gracePeriodDays,
                lateFeeEnabled,
                lateFeeFlat,
                convenienceFeeEnabled,
                convenienceFeeAmount,
              },
              select: {
                propertyId: true,
                rentDueDay: true,
                gracePeriodDays: true,
                lateFeeEnabled: true,
                lateFeeFlat: true,
                convenienceFeeEnabled: true,
                convenienceFeeAmount: true,
              },
            });

      return { property, settings };
    });

    return NextResponse.json({
      ok: true,
      property: updated.property,
      propertySettings: updated.settings,
    });
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.error("PATCH /api/admin/properties/[id] prisma error", error);
    } else {
      console.error("PATCH /api/admin/properties/[id] failed", error);
    }

    return NextResponse.json(
      { error: "Failed to update property." },
      { status: 500 }
    );
  }
}