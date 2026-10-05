// app/api/tenant/ledger/route.ts

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
      },
      orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const ledger = await prisma.ledgerEntry.findMany({
      where: {
        propertyId,
        unitId,
        tenantAssignmentId: assignment.id,
        voidedAt: null,
        effectiveDate: {
          lte: new Date(),
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });

    return NextResponse.json({
      ok: true,
      ledger,
    });
  } catch (error: unknown) {
    console.error("GET /api/tenant/ledger failed", error);

    return NextResponse.json(
      { error: "Failed to load ledger." },
      { status: 500 }
    );
  }
}