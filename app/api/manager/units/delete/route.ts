import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";
import { assertPristineUnit, DestructiveRetentionError, lockRetentionProperty, lockRetentionUnit } from "@/lib/destructiveRetention";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Body = {
  unitId?: unknown;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (
      !session ||
      !session.propertyId ||
      (session.role !== "OWNER" && session.role !== "MANAGER")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: !session ? 401 : 403 });
    }

    const body = (await req.json()) as Body;
    const unitId = clean(body.unitId);

    if (!unitId) {
      return NextResponse.json({ error: "Missing unitId." }, { status: 400 });
    }

    const deleted = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockRetentionProperty(tx, session.propertyId!);
      await lockRetentionUnit(tx, session.propertyId!, unitId);
      const existing = await tx.unit.findFirst({
        where: { id: unitId, propertyId: session.propertyId, isActive: false },
      });
      if (!existing) return false;
      await assertPristineUnit(tx, existing);
      await tx.unit.delete({ where: { id: unitId } });
      return true;
    }, { isolationLevel: "ReadCommitted" });

    if (!deleted) {
      return NextResponse.json({ error: "Inactive unit not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DestructiveRetentionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("POST /api/manager/units/delete failed", error);
    return NextResponse.json(
      { error: "Failed to delete inactive unit." },
      { status: 500 }
    );
  }
}
