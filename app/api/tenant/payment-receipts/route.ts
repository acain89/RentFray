// app/api/tenant/payment-receipts/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function centsToDollars(cents: number): number {
  return Math.round((cents || 0) / 100 * 100) / 100;
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT" || !session.unitId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payments = await prisma.payment.findMany({
      where: {
        unitId: session.unitId,
        status: "PAID",
      },
      orderBy: { updatedAt: "desc" },
    });

    const receipts = payments.map((p: (typeof payments)[number]) => ({
      id: p.id,
      amount: centsToDollars(p.amountCents),
      date: p.updatedAt,
      status: p.status,
    }));

    return NextResponse.json({ ok: true, receipts });
  } catch (err) {
    console.error("receipts error", err);
    return NextResponse.json(
      { error: "Failed to load receipts" },
      { status: 500 }
    );
  }
}