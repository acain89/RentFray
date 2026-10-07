// app/api/admin/properties/[id]/override/route.ts

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { type CheckoutInspection, CheckoutConflict, inspectTenantCheckoutAttempts, assertCheckoutReductionAllowed, lockCheckout } from "@/lib/checkoutCollectibility";
import { lockManualRows, isManualLockContention } from "@/lib/manualFinancialOperations";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function clean(value: unknown) {
  return String(value || "").trim();
}

function cleanUpper(value: unknown) {
  return clean(value).toUpperCase();
}

async function requireAdmin() {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    return null;
  }

  return session;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body: unknown = await req.json();

    const action = cleanUpper((body as { action?: unknown })?.action);
    const reason = clean((body as { reason?: unknown })?.reason);
    const unitId = clean((body as { unitId?: unknown })?.unitId);

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    if (action === "RESET_PROPERTY") {
      return NextResponse.json(
        { error: "RESET_PROPERTY is retired. Preserve history and use normal lifecycle controls." },
        { status: 410 }
      );
    }

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        paymentStatus: true,
        units: {
          orderBy: { unitNumber: "asc" },
        },
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    if (action === "FORCE_LIVE") {
      const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.property.update({
          where: { id },
          data: { status: "LIVE" },
          select: {
            id: true,
            name: true,
            propertyCode: true,
            status: true,
          },
        });

        await tx.auditLog.create({
          data: {
            propertyId: id,
            actorType: "ADMIN",
            action: "PROPERTY_FORCE_LIVE",
            targetType: "PROPERTY",
            targetId: id,
            summary: "Property forced to LIVE by admin override.",
            metadataJson: JSON.stringify({
              reason: reason || null,
              previousStatus: property.status,
              nextStatus: "LIVE",
            }),
          },
        });
        return updated;
      });

      return NextResponse.json({
        ok: true,
        action,
        property: updated,
      });
    }

    if (action === "UNLOCK_UNIT") {
      if (!unitId) {
        return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
      }

      const unit = await prisma.unit.findFirst({
        where: {
          id: unitId,
          propertyId: id,
        },
        select: {
          id: true,
          unitNumber: true,
        },
      });

      if (!unit) {
        return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      }

      const assignmentWhere = { propertyId: id, unitId, isCurrent: true };
      const affected: { id: string }[] = await prisma.tenantAssignment.findMany({ where: assignmentWhere, select: { id: true }, orderBy: { id: "asc" } });
      const inspections: CheckoutInspection[] = [];
      for (const assignment of affected) inspections.push(await inspectTenantCheckoutAttempts(prisma, { propertyId: id, unitId, tenantAssignmentId: assignment.id }));
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const inspection of inspections) await lockCheckout(tx, inspection.identity);
        for (const inspection of inspections) await assertCheckoutReductionAllowed(tx, inspection);
        await lockManualRows(tx, id, unitId, affected[0]?.id ?? null, []);
        const current: { id: string }[] = await tx.tenantAssignment.findMany({ where: assignmentWhere, select: { id: true }, orderBy: { id: "asc" } });
        if (JSON.stringify(current.map(a => a.id)) !== JSON.stringify(affected.map(a => a.id))) throw new CheckoutConflict("Tenant state changed. Refresh and retry.");
        for (const assignment of current) await tx.$queryRaw`SELECT "id" FROM "TenantAssignment" WHERE "id" = ${assignment.id} AND "propertyId" = ${id} AND "unitId" = ${unitId} FOR UPDATE NOWAIT`;
        await tx.tenantAssignment.updateMany({
          where: {
            propertyId: id,
            unitId,
            id: { in: affected.map(a => a.id) },
            isCurrent: true,
          },
          data: {
            moveOutDate: new Date(),
            isCurrent: false,
          },
        });

        await tx.unit.update({
          where: { id: unitId },
          data: {
            portalActivated: false,
            portalFirstName: null,
            portalLastName: null,
            tenantPinHash: null,
            activatedAt: null,
            activationSource: null,
          },
        });

        await tx.auditLog.create({
          data: {
            propertyId: id,
            actorType: "ADMIN",
            action: "UNIT_UNLOCKED_BY_ADMIN",
            targetType: "UNIT",
            targetId: unitId,
            summary: "Unit portal access reset by admin override.",
            metadataJson: JSON.stringify({
              reason: reason || null,
              unitNumber: unit.unitNumber,
            }),
          },
        });
      });

      return NextResponse.json({
        ok: true,
        action,
        unitId,
      });
    }

    if (action === "REPAIR_PAYMENT_STATUS") {
      const repaired = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const repaired = await tx.paymentConnectionStatus.upsert({
          where: { propertyId: id },
          update: {},
          create: {
            propertyId: id,
            processorConnected: false,
            bankConnected: false,
            chargesEnabled: false,
            payoutsEnabled: false,
            onboardingComplete: false,
            requirementsDue: false,
            requirementsSummary: null,
            lastSyncedAt: null,
            readyForLive: false,
          },
        });

        await tx.auditLog.create({
          data: {
            propertyId: id,
            actorType: "ADMIN",
            action: "PAYMENT_STATUS_REPAIRED",
            targetType: "PROPERTY",
            targetId: id,
            summary: "Payment connection status record repaired.",
            metadataJson: JSON.stringify({
              reason: reason || null,
              paymentStatusId: repaired.id,
            }),
          },
        });
        return repaired;
      });

      return NextResponse.json({
        ok: true,
        action,
        paymentStatus: repaired,
      });
    }

    return NextResponse.json(
      { error: "Invalid override action" },
      { status: 400 }
    );
  } catch (error: unknown) {
    if (error instanceof CheckoutConflict) return NextResponse.json({ error: error.message }, { status: error.status });
    if (isManualLockContention(error)) return NextResponse.json({ error: "Tenancy is busy. Refresh and retry." }, { status: 409 });
    console.error("POST /api/admin/properties/[id]/override error:", error);
    return NextResponse.json(
      { error: "Override action failed" },
      { status: 500 }
    );
  }
}