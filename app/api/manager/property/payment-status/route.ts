// app/api/manager/property/payment-status/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await prisma.paymentConnectionStatus.findUnique({
      where: { propertyId: session.propertyId },
    });

    return NextResponse.json({
      ok: true,
      status: status || {
        stripeConnected: false,
        achEnabled: false,
        onboardingComplete: false,
      },
    });
  } catch (error) {
    console.error("GET payment-status error:", error);
    return NextResponse.json({ error: "Failed to load payment status" }, { status: 500 });
  }
}