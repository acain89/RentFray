import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  BillingCalendarError,
  lockBillingCalendar,
} from "@/lib/billingCalendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  name?: unknown;
  address?: unknown;
  propertyType?: unknown;
  isActive?: unknown;
  gracePeriodDays?: unknown;
  lateFeeEnabled?: unknown;
  lateFeeFlat?: unknown;
  convenienceFeeEnabled?: unknown;
  convenienceFeeAmount?: unknown;
  rentFrayStartDate?: unknown;
};

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
}

function isPrismaKnownError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function canAccessProperty(input: {
  sessionPropertyId: string | null | undefined;
  requestedPropertyId: string;
  role: string;
}): boolean {
  if (input.role === "ADMIN") {
    return true;
  }

  return (
    (input.role === "OWNER" || input.role === "MANAGER") &&
    input.sessionPropertyId === input.requestedPropertyId
  );
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await context.params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    if (
      !canAccessProperty({
        sessionPropertyId: session.propertyId,
        requestedPropertyId: id,
        role: session.role,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        settings: true,
        tiers: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            units: {
              orderBy: { unitNumber: "asc" },
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        code: property.propertyCode,
        type: property.propertyType,
        isActive: property.isActive,
        address: property.addressLine1,
        rentFrayStartDate: property.rentFrayStartDate,
      },
      settings: property.settings,
      tiers: property.tiers.map(
  (tier: (typeof property.tiers)[number]) => ({
        id: tier.id,
        name: tier.name,
        baseRent: tier.baseRentCents / 100,
        unitCount: tier.units.length,
        rentDueDay: tier.rentDueDay,
        gracePeriodDays: tier.gracePeriodDays,
        lateFeeInitialCents: tier.lateFeeInitialCents,
        lateFeeDailyCents: tier.lateFeeDailyCents,
        maxLateFeeDays: tier.maxLateFeeDays,
      })),
    });
  } catch (error) {
    console.error("GET property failed", error);

    return NextResponse.json(
      { error: "Failed to load property." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await context.params;

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    await prisma.property.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE property failed", error);

    return NextResponse.json(
      { error: "Failed to delete property." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await context.params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    if (
      !canAccessProperty({
        sessionPropertyId: session.propertyId,
        requestedPropertyId: id,
        role: session.role,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as PatchBody;

    const rentFrayStartDateOnlyUpdate =
      Object.keys(body).length === 1 &&
      typeof body.rentFrayStartDate === "string" &&
      body.rentFrayStartDate.trim().length > 0;

    if (rentFrayStartDateOnlyUpdate) {
      if (session.role !== "OWNER" && session.role !== "ADMIN") {
        return NextResponse.json(
          {
            error:
              "Only the property owner can permanently lock the RentFray Start Date.",
          },
          { status: 403 }
        );
      }

      const locked = await lockBillingCalendar({
        propertyId: id,
        rentFrayStartDate: body.rentFrayStartDate,
        actor: {
          actorType: session.role === "ADMIN" ? "ADMIN" : "MANAGER",
          managementUserId:
            session.role === "ADMIN"
              ? null
              : session.managementUserId ?? null,
          adminId:
            session.role === "ADMIN"
              ? session.managementUserId ?? null
              : null,
        },
      });

      return NextResponse.json({
        ok: true,
        property: {
          id: locked.propertyId,
          rentFrayStartDate: locked.rentFrayStartDate,
          rentFrayStartDateString: locked.rentFrayStartDateString,
          monthlyDueDay: locked.monthlyDueDay,
        },
      });
    }

    const name = safeString(body.name);
    const address = safeString(body.address);
    const propertyType = safeString(body.propertyType || "OTHER");
    const isActive = toBoolean(body.isActive, true);

    const gracePeriodDays = toNumber(body.gracePeriodDays, 0);
    const lateFeeEnabled = toBoolean(body.lateFeeEnabled, true);
    const lateFeeFlatCents = Math.round(
      toNumber(body.lateFeeFlat, 0) * 100
    );
    const convenienceFeeEnabled = toBoolean(
      body.convenienceFeeEnabled,
      true
    );
    const convenienceFeeAmountCents = Math.round(
      toNumber(body.convenienceFeeAmount, 0) * 100
    );

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

    if (
      !Number.isInteger(gracePeriodDays) ||
      gracePeriodDays < 0 ||
      gracePeriodDays > 31
    ) {
      return NextResponse.json(
        { error: "Grace period must be 0–31." },
        { status: 400 }
      );
    }

    const existing = await prisma.property.findUnique({
      where: { id },
      select: {
        id: true,
        rentFrayStartDate: true,
        settings: {
          select: {
            id: true,
            rentDueDay: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const property = await tx.property.update({
          where: { id },
          data: {
            name,
            addressLine1: address,
            propertyType,
            isActive,
          },
        });

        const settings = existing.settings
          ? await tx.propertySettings.update({
              where: { propertyId: id },
              data: {
                gracePeriodDays,
                lateFeeEnabled,
                lateFeeFlatCents,
                convenienceFeeEnabled,
                convenienceFeeAmountCents,
              },
            })
          : await tx.propertySettings.create({
              data: {
                propertyId: id,
                rentDueDay:
                  existing.rentFrayStartDate?.getUTCDate() ?? 1,
                gracePeriodDays,
                lateFeeEnabled,
                lateFeeFlatCents,
                convenienceFeeEnabled,
                convenienceFeeAmountCents,
              },
            });

        return { property, settings };
      }
    );

    return NextResponse.json({
      ok: true,
      property: {
        id: updated.property.id,
        name: updated.property.name,
      },
      settings: updated.settings,
    });
  } catch (error: unknown) {
    if (error instanceof BillingCalendarError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (isPrismaKnownError(error)) {
      console.error("PATCH property prisma error", error);
    } else {
      console.error("PATCH property failed", error);
    }

    return NextResponse.json(
      { error: "Failed to update property." },
      { status: 500 }
    );
  }
}