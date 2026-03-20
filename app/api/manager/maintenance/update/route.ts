// app/api/manager/maintenance/update/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function clean(value: unknown) {
  return String(value || "").trim();
}

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
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: session.propertyId,
        actorRole: session.role,
        actorLabel:
          session.role === "MAINTENANCE"
            ? session.maintenanceUserId || "maintenance"
            : session.managementUserId || "management",
        action: "MAINTENANCE_REQUEST_UPDATED",
        entityType: "MAINTENANCE_REQUEST",
        entityId: requestId,
        notes: JSON.stringify({
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
    return NextResponse.json({ error: "Failed to update maintenance request" }, { status: 500 });
  }
}