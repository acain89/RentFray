import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getBusinessDate, getBusinessDateInstant } from "@/lib/rentDates";


export const runtime = "nodejs";
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

type PropertyTierRow = {
  id: string;
  name: string;
  sortOrder: number;
};

type ActiveChargeRow = {
  id: string;
  tierId: string;
  label: string;
  amountCents: number;
  effectiveDate: Date;
  sortOrder: number;
};

type SanitizedCharge = {
  label: string;
  amountCents: number;
  sortOrder: number;
};

type SanitizedTier = {
  tierId: string;
  charges: SanitizedCharge[];
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function monthBoundary(offset: number): Date {
  const now = getBusinessDate();
  const month = now.getMonth() + offset;
  const year = now.getFullYear() + Math.floor(month / 12);
  return getBusinessDateInstant(`${year}-${String(month % 12 + 1).padStart(2, "0")}-01`);
}

function firstDayOfCurrentMonth(): Date {
  return monthBoundary(0);
}

function firstDayOfNextMonth(): Date {
  return monthBoundary(1);
}

function isAuthorized(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || !["OWNER", "MANAGER", "STAFF"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const propertyId = clean(id);

    if (!session.propertyId || session.propertyId !== propertyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!propertyId) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        tiers: {
          where: { isActive: true },
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
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    const typedTiers: PropertyTierRow[] = property.tiers.map((tier: PropertyTierRow) => ({
      id: tier.id,
      name: tier.name,
      sortOrder: tier.sortOrder,
    }));

    const tierIds = typedTiers.map((tier) => tier.id);

    const nextEffectiveDate = firstDayOfNextMonth();
    const activeCharges: ActiveChargeRow[] = tierIds.length
      ? await prisma.propertyTierCharge.findMany({
          where: {
            propertyId,
            tierId: { in: tierIds },
            isActive: true,
            effectiveDate: { lte: nextEffectiveDate },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: nextEffectiveDate } }],
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
            amountCents: true,
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

    const tiers = typedTiers.map((tier) => {
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
          amount: charge.amountCents / 100,
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
      nextEffectiveMonth: nextEffectiveDate.toISOString(),
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

class ChargeInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function sanitizeSnapshot(body: unknown, tiers: PropertyTierRow[]): SanitizedTier[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as PostBody).tiers)) {
    throw new ChargeInputError("A complete tiers snapshot is required.");
  }
  const blocks = (body as PostBody).tiers!;
  const validTierIds = new Set(tiers.map(tier => tier.id));
  const seen = new Set<string>();
  const sanitized = blocks.map(block => {
    if (!block || typeof block !== "object" || typeof block.tierId !== "string" || !Array.isArray(block.charges)) {
      throw new ChargeInputError("Each tier must provide a tierId and charges array.");
    }
    const tierId = clean(block.tierId);
    if (!validTierIds.has(tierId)) throw new ChargeInputError("Tier does not belong to this property's active tiers.");
    if (seen.has(tierId)) throw new ChargeInputError("Duplicate tier block.");
    seen.add(tierId);
    const charges: SanitizedCharge[] = [];
    block.charges.forEach((charge, index) => {
      if (!charge || typeof charge !== "object" || typeof charge.label !== "string") {
        throw new ChargeInputError("Invalid charge item.");
      }
      const label = clean(charge.label);
      // The existing editor represents an empty tier with one blank draft item.
      if (!label && (charge.amount === "" || charge.amount === undefined)) return;
      if (!label) throw new ChargeInputError("Charge label is required.");
      if (typeof charge.amount !== "string" && typeof charge.amount !== "number") {
        throw new ChargeInputError("Invalid charge amount.");
      }
      const value = Number(charge.amount);
      const amountCents = Math.round(value * 100);
      if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(amountCents) || amountCents > 2147483647) {
        throw new ChargeInputError("Invalid charge amount.");
      }
      if (charge.isActive !== undefined && typeof charge.isActive !== "boolean") {
        throw new ChargeInputError("Invalid charge active flag.");
      }
      if (charge.isActive !== false) charges.push({ label, amountCents, sortOrder: index });
    });
    return { tierId, charges };
  });
  if (seen.size !== validTierIds.size) {
    throw new ChargeInputError("Provide every active tier; use an empty charges array to remove its charges.");
  }
  return sanitized;
}

function isReplacementRetryable(error: unknown): boolean {
  const value = error as { code?: string; meta?: { code?: string } };
  return value?.code === "P2034" || ["40001", "40P01"].includes(value?.meta?.code ?? value?.code ?? "");
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !isAuthorized(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await context.params;
    const propertyId = clean(id);
    if (!session.propertyId || session.propertyId !== propertyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!propertyId) return NextResponse.json({ error: "Missing property id." }, { status: 400 });
    const body: unknown = await req.json().catch(() => null);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Shared order: Property first, then authoritative scope and charge writes.
          await tx.$queryRaw`
            SELECT "id" FROM "Property" WHERE "id" = ${propertyId} FOR UPDATE
          `;
          const property = await tx.property.findUnique({
            where: { id: propertyId },
            select: { id: true, tiers: {
              where: { isActive: true },
              select: { id: true, name: true, sortOrder: true },
            } },
          });
          if (!property) throw new ChargeInputError("Property not found.", 404);
          const typedTiers: PropertyTierRow[] = property.tiers.map((tier: PropertyTierRow) => ({
            id: tier.id, name: tier.name, sortOrder: tier.sortOrder,
          }));
          const sanitizedTiers = sanitizeSnapshot(body, typedTiers);
          const nextEffectiveDate = firstDayOfNextMonth();

          // Pending sets were never effective: preserve them as canceled rows.
          await tx.propertyTierCharge.updateMany({
            where: { propertyId, isActive: true, effectiveDate: { gte: nextEffectiveDate } },
            data: { isActive: false },
          });
          // Preserve past applicability, including late generation for earlier cycles.
          await tx.propertyTierCharge.updateMany({
            where: {
              propertyId, isActive: true, effectiveDate: { lt: nextEffectiveDate },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: nextEffectiveDate } }],
            },
            data: { effectiveUntil: nextEffectiveDate },
          });
          const created: ActiveChargeRow[] = [];
          for (const tier of sanitizedTiers) {
            for (const charge of tier.charges) {
              created.push(await tx.propertyTierCharge.create({
                data: {
                  propertyId, tierId: tier.tierId, label: charge.label,
                  amountCents: charge.amountCents, effectiveDate: nextEffectiveDate,
                  effectiveUntil: null, isActive: true, sortOrder: charge.sortOrder,
                },
                select: { id: true, tierId: true, label: true, amountCents: true, effectiveDate: true, sortOrder: true },
              }));
            }
          }
          const tiers = [...typedTiers]
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
            .map(tier => ({
              tierId: tier.id, tierName: tier.name,
              charges: created.filter(charge => charge.tierId === tier.id).map(charge => ({
                id: charge.id, label: charge.label, amount: charge.amountCents / 100,
                effectiveDate: charge.effectiveDate.toISOString(), sortOrder: charge.sortOrder,
              })),
            }));
          return { ok: true, effectiveDate: nextEffectiveDate.toISOString(), tiers };
        });
        return NextResponse.json(result);
      } catch (error) {
        if (attempt < 2 && isReplacementRetryable(error)) continue;
        throw error;
      }
    }
    throw new Error("Replacement retry exhausted.");
  } catch (error) {
    if (error instanceof ChargeInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("SAVE property tier charges failed", error);
    return NextResponse.json({ error: "Failed to save charges." }, { status: 500 });
  }
}
