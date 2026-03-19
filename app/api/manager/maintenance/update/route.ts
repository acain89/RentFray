// app/api/manager/maintenance/update/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const VALID_STATUS = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
] as const;

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || session.role !== "MANAGER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const requestId = String(body.requestId || "").trim();
    const status = String(body.status || "")
      .trim()
      .toUpperCase();

    if (!requestId) {
      return NextResponse.json(
        { error: "Missing requestId" },
        { status: 400 }
      );
    }

    if (!VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const existing = await prisma.maintenanceRequest.findFirst({
      where: {
        id: requestId,
        propertyId: session.propertyId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.maintenanceRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status,
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
      request: {
        id: updated.id,
        category: updated.category,
        urgency: updated.urgency,
        status: updated.status,
        description: updated.description,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        unit: updated.unit,
      },
    });
  } catch (error) {
    console.error("manager maintenance update POST error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}