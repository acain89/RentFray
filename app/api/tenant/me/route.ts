import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireRole("TENANT");

    const unit = await prisma.unit.findUnique({
      where: { id: session.unitId },
      include: {
        property: true,
        assignments: {
          where: { moveOut: null },
          orderBy: { moveIn: "desc" },
          include: { tenant: true },
        },
      },
    });

    if (!unit || unit.assignments.length === 0) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const tenant = unit.assignments[0].tenant;

    return NextResponse.json({
      ok: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      propertyId: unit.propertyId,
      propertyName: unit.property?.name || "",
      propertyCode: unit.property?.code || "",
      unitId: unit.id,
      unitNumber: unit.unitNumber,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}