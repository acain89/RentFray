// app/api/auth/session/route.ts

import { NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ ok: false, user: null });
    }

    return NextResponse.json({
      ok: true,
      user: {
        role: session.role,
        propertyId: session.propertyId ?? null,
        managementUserId: session.managementUserId ?? null,
        unitId: session.unitId ?? null,
        maintenanceUserId: session.maintenanceUserId ?? null,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, user: null });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Use the role-specific login route for this account type.",
    },
    { status: 400 }
  );
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}