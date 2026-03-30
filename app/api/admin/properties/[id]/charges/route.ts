import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type ChargeInput = {
  label?: string;
  amount?: string | number;
  isActive?: boolean;
};

type TierChargesInput = {
  tierId?: string;
  charges?: ChargeInput[];
};

type PostBody = {
  tiers?: TierChargesInput[];
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstDayOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function firstDayOfNextMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function isAuthorized(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || !isAuthorized(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const propertyId = clean(id);

    if (!propertyId) {
      return NextResponse.json({ error: "Missing property id." }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        tiers: {
          where: {
            isActive: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const tierIds = property.tiers.map((tier) => tier.id);

    const activeCharges = tierIds.length
      ? await prisma.propertyTierCharge.findMany({
          where: {
            propertyId,
            tierId: { in: tierIds },
            isActive: true,
          },
          orderBy: [
            { tierId: "asc" },
            { effectiveDate: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            id: true,
            tierId: true,
            label: true,
            amount: true,
            effectiveDate: true,
            sortOrder: true,
          },
        })
      : [];

    const latestEffectiveByTier = new Map<string, number>();

    for (const charge of activeCharges) {
      const effectiveTime = charge.effectiveDate.getTime();
      const existing = latestEffectiveByTier.get(charge.tierId);

      if (existing === undefined || effectiveTime > existing) {
        latestEffectiveByTier.set(charge.tierId, effectiveTime);
      }
    }

    const tiers = property.tiers.map((tier) => {
      const latestEffectiveTime = latestEffectiveByTier.get(tier.id);

      const charges = activeCharges
        .filter((charge) => {
          if (charge.tierId !== tier.id) return false;
          if (latestEffectiveTime === undefined) return false;
          return charge.effectiveDate.getTime() === latestEffectiveTime;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((charge) => ({
          id: charge.id,
          label: charge.label,
          amount: charge.amount,
          effectiveDate: charge.effectiveDate.toISOString(),
          sortOrder: charge.sortOrder,
        }));

      return {
        tierId: tier.id,
        tierName: tier.name,
        charges,
      };
    });

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
      },
      effectiveMonth: firstDayOfCurrentMonth().toISOString(),
      nextEffectiveMonth: firstDayOfNextMonth().toISOString(),
      tiers,
    });
  } catch (error) {
    console.error("GET property tier charges failed", error);
    return NextResponse.json(
      { error: "Failed to load charges." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || !isAuthorized(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const propertyId = clean(id);

    if (!propertyId) {
      return NextResponse.json({ error: "Missing property id." }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as PostBody | null;
    const submittedTiers = Array.isArray(body?.tiers) ? body!.tiers : [];

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        tiers: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const validTierMap = new Map(
      property.tiers.map((tier) => [tier.id, tier] as const)
    );

    const sanitizedTiers = submittedTiers
      .map((tierBlock) => {
        const tierId = clean(tierBlock?.tierId);

        if (!tierId || !validTierMap.has(tierId)) {
          return null;
        }

        const rawCharges = Array.isArray(tierBlock?.charges) ? tierBlock.charges : [];

        const charges = rawCharges
          .map((charge, index) => {
            const label = clean(charge?.label);
            const amount = Math.round(toNumber(charge?.amount) * 100) / 100;
            const isActive = charge?.isActive !== false;

            if (!label || !isActive) {
              return null;
            }

            if (!Number.isFinite(amount) || amount < 0) {
              return null;
            }

            return {
              label,
              amount,
              sortOrder: index,
            };
          })
          .filter((charge): charge is { label: string; amount: number; sortOrder: number } => {
            return Boolean(charge);
          });

        return {
          tierId,
          charges,
        };
      })
      .filter((tier): tier is { tierId: string; charges: { label: string; amount: number; sortOrder: number }[] } => {
        return Boolean(tier);
      });

    const nextEffectiveDate = firstDayOfNextMonth();

    await prisma.$transaction(async (tx) => {
      await tx.propertyTierCharge.updateMany({
        where: {
          propertyId,
          effectiveDate: {
            gte: nextEffectiveDate,
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      for (const tier of sanitizedTiers) {
        for (const charge of tier.charges) {
          await tx.propertyTierCharge.create({
            data: {
              propertyId,
              tierId: tier.tierId,
              label: charge.label,
              amount: charge.amount,
              effectiveDate: nextEffectiveDate,
              isActive: true,
              sortOrder: charge.sortOrder,
            },
          });
        }
      }
    });

    const refreshedCharges = await prisma.propertyTierCharge.findMany({
      where: {
        propertyId,
        isActive: true,
        effectiveDate: nextEffectiveDate,
      },
      orderBy: [
        { tierId: "asc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        tierId: true,
        label: true,
        amount: true,
        effectiveDate: true,
        sortOrder: true,
      },
    });

    const tiers = property.tiers
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      })
      .map((tier) => ({
        tierId: tier.id,
        tierName: tier.name,
        charges: refreshedCharges
          .filter((charge) => charge.tierId === tier.id)
          .map((charge) => ({
            id: charge.id,
            label: charge.label,
            amount: charge.amount,
            effectiveDate: charge.effectiveDate.toISOString(),
            sortOrder: charge.sortOrder,
          })),
      }));

    return NextResponse.json({
      ok: true,
      effectiveDate: nextEffectiveDate.toISOString(),
      tiers,
    });
  } catch (error) {
    console.error("SAVE property tier charges failed", error);
    return NextResponse.json(
      { error: "Failed to save charges." },
      { status: 500 }
    );
  }
}