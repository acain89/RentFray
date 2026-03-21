// [path: app/api/manager/maintenance/update/route.ts]

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function clean(value: unknown) {
  return String(value || "").trim();
}

const ALLOWED_STATUSES = new Set(["OPEN", "IN_PROGRESS", "COMPLETE"]);

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (
      !session ||
      !["OWNER", "MANAGER", "STAFF", "MAINTENANCE"].includes(session.role) ||
      !session.propertyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const requestId = clean(body.requestId);
    const status = clean(body.status).toUpperCase();

    if (!requestId || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const requestRow = await prisma.maintenanceRequest.findFirst({
      where: {
        id: requestId,
        propertyId: session.propertyId,
      },
      include: {
        unit: {
          select: {
            unitNumber: true,
          },
        },
      },
    });

    if (!requestRow) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(status === "COMPLETE"
          ? { completedAt: new Date() }
          : { completedAt: null }),
        ...(session.role === "MAINTENANCE"
          ? { lastUpdatedByMaintenanceUserId: session.maintenanceUserId }
          : { lastUpdatedByManagementUserId: session.managementUserId }),
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: session.propertyId,
        actorType: session.role,
        actorManagementUserId:
          session.role === "OWNER" ||
          session.role === "MANAGER" ||
          session.role === "STAFF"
            ? session.managementUserId
            : null,
        actorMaintenanceUserId:
          session.role === "MAINTENANCE"
            ? session.maintenanceUserId
            : null,
        action: "MAINTENANCE_REQUEST_UPDATED",
        targetType: "MAINTENANCE_REQUEST",
        targetId: requestId,
        summary: `Maintenance request status changed from ${requestRow.status} to ${status}`,
        metadataJson: JSON.stringify({
          unitNumber: requestRow.unit.unitNumber,
          previousStatus: requestRow.status,
          nextStatus: status,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      request: updated,
    });
  } catch (error) {
    console.error("POST /api/manager/maintenance/update error:", error);
    return NextResponse.json(
      { error: "Failed to update maintenance request" },
      { status: 500 }
    );
  }
}