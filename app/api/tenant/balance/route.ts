import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("rf_session");

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);

    if (session.role !== "TENANT" || !session.unitId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: session.unitId },
      include: {
        property: true,
        assignments: {
          where: { moveOut: null },
          include: { tenant: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const ledger = await getUnitLedgerSummary(unit.id);

    return NextResponse.json({
      ok: true,
      propertyName: unit.property.name,
      unitNumber: unit.unitNumber,
      balance: ledger.balance,
      totalCharges: ledger.totalCharges,
      totalPaid: ledger.totalPaid,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load balance" },
      { status: 500 }
    );
  }
}