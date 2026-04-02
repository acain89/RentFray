import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type TierInput = {
  tierName: string;
  baseRent: string;
  dueDay: string;
  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: string;
};

type PostBody = {
  tiers?: TierInput[];
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function toCents(value: unknown): number {
  return Math.round(toNumber(value, 0) * 100);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = (await req.json()) as PostBody;

    const tiers: TierInput[] = Array.isArray(body.tiers) ? body.tiers : [];

    if (!id || tiers.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.propertyTier.updateMany({
        where: { propertyId: id },
        data: { isActive: false },
      });

      for (let i = 0; i < tiers.length; i += 1) {
        const t = tiers[i];

        const name = String(t.tierName || "").trim() || `Tier ${i + 1}`;
        const baseRentCents = toCents(t.baseRent);
        const rentDueDay = toInt(t.dueDay, 1);
        const gracePeriodDays = toInt(t.graceDays, 0);
        const lateFeeInitialCents = t.lateFeeEnabled ? toCents(t.lateFeeAmount) : 0;

        await tx.propertyTier.upsert({
          where: {
            propertyId_name: {
              propertyId: id,
              name,
            },
          },
          update: {
            baseRentCents,
            rentDueDay,
            gracePeriodDays,
            lateFeeInitialCents,
            sortOrder: i,
            isActive: true,
          },
          create: {
            propertyId: id,
            name,
            baseRentCents,
            rentDueDay,
            gracePeriodDays,
            lateFeeInitialCents,
            sortOrder: i,
            isActive: true,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("SAVE TIERS FAILED", err);
    return NextResponse.json(
      { error: "Failed to save tiers" },
      { status: 500 }
    );
  }
}