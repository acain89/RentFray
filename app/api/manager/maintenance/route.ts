// app/api/manager/maintenance/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "MANAGER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        propertyId: session.propertyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      requests: requests.map((r) => ({
        id: r.id,
        category: r.category,
        urgency: r.urgency,
        status: r.status,
        description: r.description,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        unit: r.unit,
      })),
    });
  } catch (error) {
    console.error("manager maintenance GET error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}