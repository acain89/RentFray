import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    // ✅ enforce session + role
    const session = await requireRole("TENANT");

    if (!session.unitId || !session.propertyId || !session.tenantAssignmentId?.trim()) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        unitId: session.unitId,
        propertyId: session.propertyId,
        tenantAssignmentId: session.tenantAssignmentId,
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
