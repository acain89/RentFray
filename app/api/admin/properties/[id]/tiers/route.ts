import { NextResponse } from "next/server";
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

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const tiers = Array.isArray(body.tiers) ? (body.tiers as TierInput[]) : [];

    if (!id || tiers.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // deactivate existing tiers (soft reset)
      await tx.propertyTier.updateMany({
        where: { propertyId: id },
        data: { isActive: false },
      });

      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];

        const name = String(t.tierName || "").trim() || `Tier ${i + 1}`;

        await tx.propertyTier.upsert({
          where: {
            propertyId_name: {
              propertyId: id,
              name,
            },
          },
          update: {
            baseRent: toNumber(t.baseRent),
            rentDueDay: toNumber(t.dueDay, 1),
            gracePeriodDays: toNumber(t.graceDays, 0),
            lateFeeInitial: t.lateFeeEnabled
              ? toNumber(t.lateFeeAmount)
              : 0,
            sortOrder: i,
            isActive: true,
          },
          create: {
            propertyId: id,
            name,
            baseRent: toNumber(t.baseRent),
            rentDueDay: toNumber(t.dueDay, 1),
            gracePeriodDays: toNumber(t.graceDays, 0),
            lateFeeInitial: t.lateFeeEnabled
              ? toNumber(t.lateFeeAmount)
              : 0,
            sortOrder: i,
            isActive: true,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("SAVE TIERS FAILED", err);
    return NextResponse.json({ error: "Failed to save tiers" }, { status: 500 });
  }
}