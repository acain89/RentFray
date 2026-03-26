import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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

    const ledger = await prisma.ledgerEntry.findMany({
      where: {
        propertyId,
        unitId,
        voidedAt: null,
      },
      orderBy: { effectiveDate: "desc" },
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