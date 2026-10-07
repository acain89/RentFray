import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CheckoutConflict, inspectTenantCheckoutAttempts, assertCheckoutReductionAllowed, lockCheckout } from "@/lib/checkoutCollectibility";

import { getSession } from "@/lib/session";
import { emitEvent } from "@/lib/realtime";
import { ManualOperationError, normalizeOperationId, lockManualOperation, lockManualTenancy,
  lockManualRows, replayTierMove, isManualRetryable, isManualLockContention } from "@/lib/manualFinancialOperations";
import {
  getRentDateSummary,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";
import { assertTierBillingCalendar } from "@/lib/billingCalendar";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MoveTierBody = {
  unitId?: unknown;
  targetTierId?: unknown;
  operationId?: unknown;
  expectedSourceTierId?: unknown;
  tenantAssignmentId?: unknown;
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

type MoveTierResult = Extract<MoveTierResponse, { ok: true }>["data"];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isAllowedRole(role: string): role is "OWNER" | "MANAGER" {
  return role === "OWNER" || role === "MANAGER";
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

    const operationId = normalizeOperationId(body.operationId);
    if (!("expectedSourceTierId" in body) || !("tenantAssignmentId" in body) ||
        (body.expectedSourceTierId !== null && typeof body.expectedSourceTierId !== "string") ||
        (body.tenantAssignmentId !== null && typeof body.tenantAssignmentId !== "string")) {
      throw new ManualOperationError("Expected source tier and tenant assignment must be explicitly supplied.", 400);
    }
    const expectedSourceTierId = body.expectedSourceTierId === null ? null : clean(body.expectedSourceTierId);
    const tenantAssignmentId = body.tenantAssignmentId === null ? null : clean(body.tenantAssignmentId);
    if (expectedSourceTierId === "" || tenantAssignmentId === "") throw new ManualOperationError("Invalid expected source state.", 400);
    const payload = { unitId, targetTierId, expectedSourceTierId, tenantAssignmentId };
    const now = new Date();

    let result: MoveTierResult | undefined;
    let replayed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        replayed = false;
        const knownReplay = await replayTierMove<MoveTierResult>(prisma, propertyId, operationId, payload);
        const inspection = tenantAssignmentId && !knownReplay ? await inspectTenantCheckoutAttempts(prisma, { propertyId, unitId, tenantAssignmentId }) : null;
        result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await lockManualOperation(tx, "TIER_MOVE", propertyId, operationId);
        const replay = await replayTierMove<MoveTierResult>(tx, propertyId, operationId, payload);
        if (replay) { replayed = true; return replay; }
        const provisional = await tx.unit.findFirst({ where: { id: unitId, propertyId, isActive: true }, include: { tier: true, property: { include: { settings: true } } } });
        if (!provisional) throw new Error("UNIT_NOT_FOUND");
        const provisionalCycle = getRentDateSummary({ ...resolveEffectiveBillingSettings({ tier: provisional.tier, propertySettings: provisional.property.settings }),
          dueDay: assertTierBillingCalendar({ propertyId, rentFrayStartDate: provisional.property.rentFrayStartDate,
            propertySettingsDueDay: provisional.property.settings?.rentDueDay, tier: provisional.tier }),
          now, rentFrayStartDate: provisional.property.rentFrayStartDate }).billingCycle;
        await lockManualTenancy(tx, propertyId, unitId, tenantAssignmentId, provisionalCycle);
        if (tenantAssignmentId && !inspection) throw new CheckoutConflict("Operation state changed. Retry the same operation.");
        if (inspection) await assertCheckoutReductionAllowed(tx, inspection);
        await lockManualRows(tx, propertyId, unitId, tenantAssignmentId, [targetTierId, ...(provisional.tierId ? [provisional.tierId] : [])]);
        const property = await tx.property.findUnique({
          where: { id: propertyId },
          select: {
            id: true,
            rentFrayStartDate: true,
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
                propertyId: true,
                isActive: true,
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

        if (unit.tierId !== expectedSourceTierId) throw new ManualOperationError("Source tier changed. Start a new move after refreshing.");
        if (unit.tierId && (!unit.tier || unit.tier.propertyId !== propertyId || !unit.tier.isActive)) throw new ManualOperationError("Source tier does not belong to the active property.");
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

const permanentDueDay = assertTierBillingCalendar({
  propertyId: property.id,
  rentFrayStartDate: property.rentFrayStartDate,
  propertySettingsDueDay: property.settings?.rentDueDay,
  tier: unit.tier,
});

const currentTierSettings = resolveEffectiveBillingSettings({
  tier: unit.tier,
  propertySettings: property.settings,
});

currentTierSettings.dueDay = permanentDueDay;

const rentDates = getRentDateSummary({
  ...currentTierSettings,
  now,
  rentFrayStartDate: property.rentFrayStartDate,
});

        if (rentDates.billingCycle !== provisionalCycle || unit.tierId !== provisional.tierId) throw new ManualOperationError("Billing state changed. Retry the same operation.");

        const activeAssignment = await tx.tenantAssignment.findFirst({
          where: {
            propertyId: propertyId,
            unitId: unit.id,
            isCurrent: true,
            OR: [{ moveOutDate: null }, { moveOutDate: { gt: now } }],
            AND: [{ OR: [{ moveInDate: null }, { moveInDate: { lte: now } }] }],
          },
          orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
          },
        });

        if ((activeAssignment?.id ?? null) !== tenantAssignmentId) throw new ManualOperationError("Tenant assignment changed. Refresh before starting a new move.");

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
    ...(activeAssignment
      ? { tenantAssignmentId: activeAssignment.id }
      : {}),
  },
  select: {
    id: true,
    amountCents: true,
  },
});

const currentCycleRentChargeTotal = currentCycleRentCharges.reduce(
  (sum, entry) => sum + Math.max(0, entry.amountCents),
  0
);

const oldTierRentCents = Math.max(
  0,
  unit.tier?.baseRentCents ?? 0
);

const newTierRentCents = Math.max(
  0,
  targetTier.baseRentCents ?? 0
);

const shouldReplaceCurrentCycleRent =
  !hasPaidCurrentCycle &&
  currentCycleRentChargeTotal > 0 &&
  currentCycleRentChargeTotal !== newTierRentCents;

const adjustmentCents = shouldReplaceCurrentCycleRent
  ? newTierRentCents - currentCycleRentChargeTotal
  : 0;
        
if (shouldReplaceCurrentCycleRent && !activeAssignment) throw new ManualOperationError("Historical rent cannot be replaced without a current, explicitly bound assignment.");

await tx.unit.update({
  where: { id: unit.id },
  data: {
    tierId: targetTier.id,
  },
});

const previousTierActiveUnitCount = unit.tierId
  ? await tx.unit.count({
      where: {
        propertyId,
        tierId: unit.tierId,
        isActive: true,
      },
    })
  : 0;

const targetTierActiveUnitCount = await tx.unit.count({
  where: {
    propertyId,
    tierId: targetTier.id,
    isActive: true,
  },
});

// counts currently include moved unit already
const correctedPreviousTierCount = Math.max(
  0,
  previousTierActiveUnitCount
);

const correctedTargetTierCount = Math.max(
  0,
  targetTierActiveUnitCount
);

if (unit.tierId) {
  await tx.propertyTier.update({
    where: { id: unit.tierId },
    data: {
      activeUnitCount: correctedPreviousTierCount,
    },
  });
}

await tx.propertyTier.update({
  where: { id: targetTier.id },
  data: {
    activeUnitCount: correctedTargetTierCount,
  },
});

if (shouldReplaceCurrentCycleRent) {
  await tx.ledgerEntry.updateMany({
    where: {
      id: {
        in: currentCycleRentCharges.map((e) => e.id),
      },
    },
    data: {
      voidedAt: now,
    },
  });

  await tx.ledgerEntry.create({
    data: {
      propertyId: propertyId,
      unitId: unit.id,
      tenantAssignmentId: activeAssignment?.id ?? null,
      billingCycle: rentDates.billingCycle,
      entryType: "CHARGE",
      chargeType: "RENT",
      amountCents: newTierRentCents,
      effectiveDate: now,
      idempotencyKey: `TIER_MOVE:${propertyId}:${unit.id}:${operationId}:RENT`,
      memo: `Current-cycle RENT replaced after tier move. Other ledger entries were preserved. (${unit.tier?.name ?? "Units"} → ${targetTier.name})`,
      createdByManagementUserId:
        session.managementUserId ?? null,
    },
  });
}
        
        const completed: MoveTierResult = {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          previousTierId: unit.tierId,
          previousTierName: unit.tier?.name ?? "Units",
          targetTierId: targetTier.id,
          targetTierName: targetTier.name,
          billingCycle: rentDates.billingCycle,
          adjustmentCents,
        };
        await tx.auditLog.create({ data: {
          propertyId, actorType: session.role, actorManagementUserId: session.managementUserId ?? null,
          action: "TIER_MOVE_COMPLETED", targetType: "UNIT", targetId: unit.id,
          summary: `Unit ${unit.unitNumber} moved to tier ${targetTier.name}`,
          metadataJson: JSON.stringify({ operation: { id: operationId, payload, result: completed } }),
        } });
        return completed;
      },
      {
        maxWait: 10_000,
        timeout: 20_000,
        isolationLevel: "ReadCommitted",
      }
    );

        break;
      } catch (error) {
        if (isManualRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    if (!result) throw new Error("Tier move did not complete.");
    if (!replayed) {
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

    }
    return NextResponse.json<MoveTierResponse>({
      ok: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof CheckoutConflict) return NextResponse.json<MoveTierResponse>({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof ManualOperationError) return NextResponse.json<MoveTierResponse>({ ok: false, error: error.message }, { status: error.status });
    if (isManualLockContention(error) || isManualRetryable(error)) return NextResponse.json<MoveTierResponse>({ ok: false, error: "Financial state is busy. Retry the same operation." }, { status: 409 });
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
