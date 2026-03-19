// app/api/tenant/payment-history/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT" || !session.unitId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        unitId: session.unitId,
        propertyId: session.propertyId,
      },
      orderBy: [
        { effectiveDate: "desc" },
        { createdAt: "desc" },
      ],
      take: 100,
    });

    const payments = entries
      .filter((e) => e.amount < 0)
      .map((e) => ({
        id: e.id,
        type: e.type,
        amount: Math.abs(e.amount),
        method: e.method || "UNKNOWN",
        reference: e.reference || null,
        note: e.note || null,
        effectiveDate: e.effectiveDate,
        createdAt: e.createdAt,
      }));

    return NextResponse.json({
      ok: true,
      payments,
    });
  } catch (error) {
    console.error("tenant payment-history GET error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}