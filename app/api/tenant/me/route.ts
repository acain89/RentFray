import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { propertyId, unitId, tenantAssignmentId } = session;

    if (!propertyId || !unitId || !tenantAssignmentId) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const assignment = await prisma.tenantAssignment.findFirst({
      where: {
        id: tenantAssignmentId,
        propertyId,
        unitId,
        isCurrent: true,
        OR: [{ moveOutDate: null }, { moveOutDate: { gt: new Date() } }],
        unit: { id: unitId, propertyId },
      },
      select: {
        firstName: true,
        lastName: true,
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      unit: {
        ...assignment.unit,
        portalFirstName: assignment.firstName,
        portalLastName: assignment.lastName,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/tenant/me failed", error);

    return NextResponse.json(
      { error: "Failed to load tenant data." },
      { status: 500 }
    );
  }
}
