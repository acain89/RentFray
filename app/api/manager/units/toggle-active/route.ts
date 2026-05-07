import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const session = await requireRole("MANAGER");

    if (!session.propertyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { unitId, makeActive } = body as {
      unitId?: string;
      makeActive?: boolean;
    };

    if (!unitId || typeof makeActive !== "boolean") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        propertyId: session.propertyId,
      },
      include: {
        tenantAssignments: {
          where: {
          isCurrent: true,
          OR: [
         { moveOutDate: null },
         { moveOutDate: { gt: new Date() } },
            ],
           },
          take: 1,
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // 🚫 Prevent inactivating occupied unit
    if (!makeActive && unit.tenantAssignments.length > 0) {
      return NextResponse.json(
        { error: "Cannot inactivate an occupied unit" },
        { status: 400 }
      );
    }

    // 🧠 TUC enforcement on reactivation
    if (makeActive) {
      const activeCount = await prisma.unit.count({
        where: {
          propertyId: session.propertyId,
          isActive: true,
        },
      });

      const property = await prisma.property.findUnique({
        where: { id: session.propertyId },
        select: { unitCount: true },
      });

      if (!property) {
        return NextResponse.json({ error: "Property not found" }, { status: 404 });
      }

      if (activeCount >= property.unitCount) {
        return NextResponse.json(
          { error: "Unit capacity reached" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.unit.update({
      where: { id: unit.id },
      data: { isActive: makeActive },
    });

    return NextResponse.json({ ok: true, unit: updated });
  } catch (err) {
    console.error("toggle unit active error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
