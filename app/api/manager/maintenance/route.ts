// app/api/manager/maintenance/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (
      !session ||
      !["OWNER", "MANAGER", "STAFF"].includes(session.role) ||
      !session.propertyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        propertyId: session.propertyId,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        unit: {
          select: {
            unitNumber: true,
            tenantName: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      requests: requests.map((row) => ({
        id: row.id,
        unitNumber: row.unit.unitNumber,
        tenantName: row.unit.tenantName,
        category: row.category,
        urgency: row.urgency,
        status: row.status,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/manager/maintenance error:", error);
    return NextResponse.json({ error: "Failed to load maintenance" }, { status: 500 });
  }
}