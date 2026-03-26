import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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

    // 🔒 HARD FILTER — NO CROSS ACCESS
    const ledger = await prisma.ledgerEntry.findMany({
      where: {
        propertyId,
        unitId,
        voidedAt: null,
      },
      orderBy: { effectiveDate: "asc" },
    });

    let balance = 0;

    for (const entry of ledger) {
      if (entry.entryType === "CHARGE") {
        balance += entry.amount;
      } else if (
        entry.entryType === "PAYMENT" ||
        entry.entryType === "CREDIT"
      ) {
        balance -= entry.amount;
      }
    }

    return NextResponse.json({
      ok: true,
      balance: roundMoney(balance),
      ledger,
    });
  } catch (error: unknown) {
    console.error("GET /api/tenant/balance failed", error);

    return NextResponse.json(
      { error: "Failed to load balance." },
      { status: 500 }
    );
  }
}