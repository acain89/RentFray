import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || !session.propertyId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const unitId = String(body.unitId || "");
    const isActive = Boolean(body.isActive);

    if (!unitId) {
      return NextResponse.json({ ok: false, error: "Missing unitId" }, { status: 400 });
    }

    await prisma.unit.update({
      where: { id: unitId },
      data: { isActive },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to update unit" }, { status: 500 });
  }
}