import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { emitEvent } from "@/lib/realtime";
import { getRentDateSummary, resolveEffectiveBillingSettings } from "@/lib/rentDates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MoveTierBody = {
  unitId?: unknown;
  targetTierId?: unknown;
};

type MoveTierResponse =
  | {
      ok: true;
      data: {
        unitId: string;
        unitNumber: string;
        previousTierId: string | null;
        previousTierName: string;
        targetTierId: string;
        targetTierName: string;
        billingCycle: string | null;
        adjustmentCents: number;
      };
    }
  | { ok: false; error: string };

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isAllowedRole(role: string): role is "OWNER" | "MANAGER" {
  return role === "OWNER" || role === "MANAGER";
}

function toSafeInteger(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function getSignedLedgerImpactCents(input: {
  entryType: string | null;
  amountCents: number;
  paymentStatus?: string | null;
}): number {
  const entryType = String(input.entryType ?? "").toUpperCase();
  const paymentStatus = String(input.paymentStatus ?? "").toUpperCase();
  const amountCents = toSafeInteger(input.amountCents);
  const absAmountCents = Math.abs(amountCents);

  if (entryType === "CHARGE") return absAmountCents;
  if (entryType === "PAYMENT") return paymentStatus === "PAID" ? -absAmountCents : 0;
  if (entryType === "CREDIT") return -absAmountCents;
  if (entryType === "ADJUSTMENT") return amountCents;

  return 0;
}

function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !isAllowedRole(session.role)) {
  return NextResponse.json<MoveTierResponse>(
    { ok: false, error: "Unauthorized" },
    { status: 401 }
  );
}

const propertyId = session.propertyId;

    const body = (await req.json()) as MoveTierBody;
    const unitId = clean(body.unitId);
    const targetTierId = clean(body.targetTierId);

    if (!unitId) {
      return NextResponse.json<MoveTierResponse>(
        { ok: false, error: "Unit ID is required." },
        { status: 400 }
      );
    }

    if (!targetTierId) {
      return NextResponse.json<MoveTierResponse>(
        { ok: false, error: "Target tier is required." },
        { status: 400 }
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const property = await tx.property.findUnique({
          where: { id: propertyId },
          select: {
            id: true,
            billingCycleStartDate: true,
            settings: true,
          },
        });

        if (!property) {
          throw new Error("PROPERTY_NOT_FOUND");
        }

        const unit = await tx.unit.findFirst({
          where: {
            id: unitId,
            propertyId: propertyId,
            isActive: true,
          },
          select: {
            id: true,
            propertyId: true,
            tierId: true,
            unitNumber: true,
            tier: {
              select: {
                id: true,
                name: true,
                baseRentCents: true,
                rentDueDay: true,
                gracePeriodDays: true,
                lateFeeInitialCents: true,
                lateFeeDailyCents: true,
                maxLateFeeDays: true,
              },
            },
          },
        });

        if (!unit) {
          throw new Error("UNIT_NOT_FOUND");
        }

        if (unit.tierId === targetTierId) {
          throw new Error("SAME_TIER");
        }

        const targetTier = await tx.propertyTier.findFirst({
          where: {
            id: targetTierId,
            propertyId: propertyId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            baseRentCents: true,
            unitCount: true,
            rentDueDay: true,
            gracePeriodDays: true,
            lateFeeInitialCents: true,
            lateFeeDailyCents: true,
            maxLateFeeDays: true,
          },
        });

        if (!targetTier) {
          throw new Error("TARGET_TIER_NOT_FOUND");
        }

        const activeTargetTierUnitCount = await tx.unit.count({
          where: {
            propertyId: propertyId,
            tierId: targetTier.id,
            isActive: true,
            NOT: {
              id: unit.id,
            },
          },
        });

        if (targetTier.unitCount <= 0 || activeTargetTierUnitCount >= targetTier.unitCount) {
          throw new Error("TARGET_TIER_FULL");
        }

        const currentTierSettings = resolveEffectiveBillingSettings({
          tier: unit.tier,
          propertySettings: property.settings,
        });

        const rentDates = getRentDateSummary({
          ...currentTierSettings,
          now,
          billingCycleStartDate: property.billingCycleStartDate,
        });

        const activeAssignment = await tx.tenantAssignment.findFirst({
          where: {
            propertyId: propertyId,
            unitId: unit.id,
            isCurrent: true,
            OR: [{ moveOutDate: null }, { moveOutDate: { gt: now } }],
          },
          orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
          },
        });

        const cyclePayments = await tx.payment.findMany({
          where: {
            propertyId: propertyId,
            unitId: unit.id,
            billingCycle: rentDates.billingCycle,
            ...(activeAssignment ? { tenantAssignmentId: activeAssignment.id } : {}),
          },
          select: {
            status: true,
          },
        });

        const paymentStatuses = cyclePayments.map((payment) =>
          String(payment.status ?? "").toUpperCase()
        );

        if (paymentStatuses.includes("PENDING")) {
          throw new Error("PENDING_PAYMENT");
        }

        const hasPaidCurrentCycle = paymentStatuses.includes("PAID");

         const currentCycleRentCharges = await tx.ledgerEntry.findMany({
  where: {
    propertyId: propertyId,
    unitId: unit.id,
    billingCycle: rentDates.billingCycle,
    entryType: "CHARGE",
    chargeType: "RENT",
    voidedAt: null,
    ...(activeAssignment ? { tenantAssignmentId: activeAssignment.id } : {}),
  },
  select: {
    amountCents: true,
  },
});

const currentCycleRentChargeTotal = currentCycleRentCharges.reduce(
  (sum, entry) => sum + Math.max(0, entry.amountCents),
  0
);
       
        const oldTierRentCents = Math.max(0, unit.tier?.baseRentCents ?? 0);
        const newTierRentCents = Math.max(0, targetTier.baseRentCents ?? 0);
       const adjustmentCents =
  !hasPaidCurrentCycle && currentCycleRentChargeTotal > 0
    ? newTierRentCents - oldTierRentCents
    : 0;

        await tx.unit.update({
          where: { id: unit.id },
          data: {
            tierId: targetTier.id,
          },
        });

        if (adjustmentCents !== 0) {
          await tx.ledgerEntry.create({
            data: {
              propertyId: propertyId,
              unitId: unit.id,
              tenantAssignmentId: activeAssignment?.id ?? null,
              billingCycle: rentDates.billingCycle,
              entryType: "ADJUSTMENT",
              chargeType: "TIER_MOVE_ADJUSTMENT",
              amountCents: adjustmentCents,
              effectiveDate: now,
              memo: `Tier move adjustment: ${unit.tier?.name ?? "Units"} to ${targetTier.name} (${formatMoney(adjustmentCents)})`,
              createdByManagementUserId: session.managementUserId ?? null,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            propertyId: propertyId,
            actorType: session.role,
            actorManagementUserId: session.managementUserId ?? null,
            action: "UNIT_TIER_MOVED",
            targetType: "UNIT",
            targetId: unit.id,
            summary: `Unit ${unit.unitNumber} moved from ${unit.tier?.name ?? "Units"} to ${targetTier.name}`,
            metadataJson: JSON.stringify({
              unitId: unit.id,
              unitNumber: unit.unitNumber,
              previousTierId: unit.tierId,
              previousTierName: unit.tier?.name ?? "Units",
              targetTierId: targetTier.id,
              targetTierName: targetTier.name,
              billingCycle: rentDates.billingCycle,
              hasPaidCurrentCycle,
              currentCycleRentChargeTotal,
              oldTierRentCents,
              newTierRentCents,
              adjustmentCents,
            }),
          },
        });

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          previousTierId: unit.tierId,
          previousTierName: unit.tier?.name ?? "Units",
          targetTierId: targetTier.id,
          targetTierName: targetTier.name,
          billingCycle: rentDates.billingCycle,
          adjustmentCents,
        };
      }
    );

    emitEvent("unit:update", {
      propertyId: propertyId,
      unitId: result.unitId,
      source: "UNIT_TIER_MOVED",
    });

    emitEvent("ledger:update", {
      propertyId: propertyId,
      unitId: result.unitId,
      source: "UNIT_TIER_MOVED",
    });

    return NextResponse.json<MoveTierResponse>({
      ok: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "PROPERTY_NOT_FOUND") {
      return NextResponse.json<MoveTierResponse>(
        { ok: false, error: "Property not found." },
        { status: 404 }
      );
    }

    if (message === "UNIT_NOT_FOUND") {
      return NextResponse.json<MoveTierResponse>(
        { ok: false, error: "Active unit not found." },
        { status: 404 }
      );
    }

    if (message === "TARGET_TIER_NOT_FOUND") {
      return NextResponse.json<MoveTierResponse>(
        { ok: false, error: "Target tier not found." },
        { status: 404 }
      );
    }

    if (message === "SAME_TIER") {
      return NextResponse.json<MoveTierResponse>(
        { ok: false, error: "Unit is already assigned to this tier." },
        { status: 400 }
      );
    }

    if (message === "TARGET_TIER_FULL") {
      return NextResponse.json<MoveTierResponse>(
        { ok: false, error: "Target tier is full. Increase the tier capacity or choose another tier." },
        { status: 409 }
      );
    }

    if (message === "PENDING_PAYMENT") {
      return NextResponse.json<MoveTierResponse>(
        { ok: false, error: "This unit has a pending payment. Wait until it succeeds or fails before moving tiers." },
        { status: 409 }
      );
    }

    console.error("POST /api/manager/units/move-tier failed", error);

    return NextResponse.json<MoveTierResponse>(
      { ok: false, error: "Failed to move unit." },
      { status: 500 }
    );
  }
}