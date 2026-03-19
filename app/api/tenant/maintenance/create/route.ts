import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const unitId = String(body.unitId || "").trim();
    const category = String(body.category || "").trim();
    const urgency = String(body.urgency || "").trim();
    const description = String(body.description || "").trim();

    if (!unitId || !category || !urgency || !description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        assignments: {
          where: { moveOut: null },
          orderBy: { moveIn: "desc" },
          include: { tenant: true },
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

    const created = await prisma.maintenanceRequest.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantId: activeTenant.id,
        category,
        urgency,
        status: "OPEN",
        description,
      },
    });

    return NextResponse.json({ ok: true, requestId: created.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create maintenance request" },
      { status: 500 }
    );
  }
}