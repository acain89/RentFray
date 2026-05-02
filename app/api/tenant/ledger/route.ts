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

    const { propertyId, unitId } = session;

    if (!propertyId || !unitId) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const assignment = await prisma.tenantAssignment.findFirst({
      where: {
        propertyId,
        unitId,
        isCurrent: true,
      },
      orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const ledger = await prisma.ledgerEntry.findMany({
      where: {
        propertyId,
        unitId,
        tenantAssignmentId: assignment?.id ?? "__NO_ACTIVE_ASSIGNMENT__",
        voidedAt: null,
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
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