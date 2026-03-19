// app/api/tenant/maintenance/list/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT" || !session.unitId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        unitId: session.unitId,
        propertyId: session.propertyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        category: true,
        urgency: true,
        status: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      requests,
    });
  } catch (error) {
    console.error("tenant maintenance list GET error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}