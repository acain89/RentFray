// app/api/admin/properties/[id]/override/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const action = cleanUpper(body.action);
    const reason = clean(body.reason);
    const unitId = clean(body.unitId);

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        paymentConnectionStatus: true,
        units: {
          orderBy: { unitNumber: "asc" },
          include: {
            assignments: {
              where: { moveOut: null },
              orderBy: { moveIn: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (action === "FORCE_LIVE") {
      const updated = await prisma.property.update({
        where: { id },
        data: { status: "LIVE" },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          propertyId: id,
          actorRole: "ADMIN",
          actorLabel: session.adminAccessId || "admin",
          action: "PROPERTY_FORCE_LIVE",
          entityType: "PROPERTY",
          entityId: id,
          notes: JSON.stringify({
            reason: reason || null,
            previousStatus: property.status,
            nextStatus: "LIVE",
          }),
        },
      });

      return NextResponse.json({
        ok: true,
        action,
        property: updated,
      });
    }

    if (action === "RESET_PROPERTY") {
      await prisma.$transaction(async (tx) => {
        await tx.maintenanceRequest.deleteMany({
          where: { propertyId: id },
        });

        await tx.ledgerEntry.deleteMany({
          where: { propertyId: id },
        });

        await tx.tenantAssignment.updateMany({
          where: {
            unit: { propertyId: id },
            moveOut: null,
          },
          data: {
            moveOut: new Date(),
          },
        });

        await tx.unit.updateMany({
          where: { propertyId: id },
          data: {
            portalActivated: false,
            tenantPinHash: null,
            tenantName: null,
          },
        });

        await tx.paymentConnectionStatus.upsert({
          where: { propertyId: id },
          update: {
            stripeConnected: false,
            achEnabled: false,
            onboardingComplete: false,
            adminApproved: false,
            notes: null,
          },
          create: {
            propertyId: id,
            stripeConnected: false,
            achEnabled: false,
            onboardingComplete: false,
            adminApproved: false,
            notes: null,
          },
        });

        await tx.property.update({
          where: { id },
          data: {
            status: "SETUP",
          },
        });

        await tx.auditLog.create({
          data: {
            propertyId: id,
            actorRole: "ADMIN",
            actorLabel: session.adminAccessId || "admin",
            action: "PROPERTY_RESET",
            entityType: "PROPERTY",
            entityId: id,
            notes: JSON.stringify({
              reason: reason || null,
            }),
          },
        });
      });

      return NextResponse.json({
        ok: true,
        action,
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
      });

      if (!unit) {
        return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.tenantAssignment.updateMany({
          where: {
            unitId,
            moveOut: null,
          },
          data: {
            moveOut: new Date(),
          },
        });

        await tx.unit.update({
          where: { id: unitId },
          data: {
            portalActivated: false,
            tenantPinHash: null,
            tenantName: null,
          },
        });

        await tx.auditLog.create({
          data: {
            propertyId: id,
            actorRole: "ADMIN",
            actorLabel: session.adminAccessId || "admin",
            action: "UNIT_UNLOCKED_BY_ADMIN",
            entityType: "UNIT",
            entityId: unitId,
            notes: JSON.stringify({
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
      const repaired = await prisma.paymentConnectionStatus.upsert({
        where: { propertyId: id },
        update: {},
        create: {
          propertyId: id,
          stripeConnected: false,
          achEnabled: false,
          onboardingComplete: false,
          adminApproved: false,
          notes: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          propertyId: id,
          actorRole: "ADMIN",
          actorLabel: session.adminAccessId || "admin",
          action: "PAYMENT_STATUS_REPAIRED",
          entityType: "PROPERTY",
          entityId: id,
          notes: JSON.stringify({
            reason: reason || null,
            paymentStatusId: repaired.id,
          }),
        },
      });

      return NextResponse.json({
        ok: true,
        action,
        paymentStatus: repaired,
      });
    }

    return NextResponse.json({ error: "Invalid override action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/admin/properties/[id]/override error:", error);
    return NextResponse.json({ error: "Override action failed" }, { status: 500 });
  }
}