import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json();
    const unitId = String(body.unitId || "").trim();

    if (!unitId) {
      return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: true,
        assignments: {
          where: { moveOut: null },
          orderBy: { moveIn: "desc" },
          include: { tenant: true },
        },
        maintenanceRequests: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const activeTenant = unit.assignments[0]?.tenant ?? null;

    if (!activeTenant || activeTenant.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "No active tenant for unit" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      propertyName: unit.property.name,
      propertyCode: unit.property.code,
      unitNumber: unit.unitNumber,
      requests: unit.maintenanceRequests
        .filter((r) => !r.tenantId || r.tenantId === activeTenant.id)
        .map((r) => ({
          id: r.id,
          category: r.category,
          urgency: r.urgency,
          status: r.status,
          description: r.description,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load maintenance requests" },
      { status: 500 }
    );
  }
}