import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManagerLevelSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await requireManagerLevelSession();

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

   const result = await prisma.$transaction(
  async (tx: Prisma.TransactionClient) => {
    // Share activation's property lock before reading occupancy or capacity.
    await tx.$queryRaw`SELECT "id" FROM "Property" WHERE "id" = ${session.propertyId} FOR UPDATE`;
    const unit = await tx.unit.findFirst({
      where: {
        id: unitId,
        propertyId: session.propertyId,
      },
      include: {
        tenantAssignments: {
          where: {
            isCurrent: true,
            OR: [{ moveOutDate: null }, { moveOutDate: { gt: new Date() } }],
          },
          take: 1,
        },
        tier: {
          select: {
            id: true,
            unitCount: true,
            activeUnitCount: true,
            isActive: true,
          },
        },
      },
    });

    if (!unit) {
      throw new Error("Unit not found");
    }

    if (!makeActive && unit.tenantAssignments.length > 0) {
      throw new Error("Cannot inactivate an occupied unit");
    }

    if (makeActive && unit.tierId) {
      if (!unit.tier || !unit.tier.isActive) {
        throw new Error("Tier does not belong to property.");
      }

      const activeTierUnitCount = await tx.unit.count({
        where: {
          propertyId: session.propertyId,
          tierId: unit.tierId,
          isActive: true,
        },
      });

      if (activeTierUnitCount >= unit.tier.unitCount) {
        throw new Error("Max number of units have been activated for this tier.");
      }
    }

    const updated = await tx.unit.update({
      where: { id: unit.id },
      data: { isActive: makeActive },
    });

    if (unit.tierId) {
      const activeTierUnitCount = await tx.unit.count({
        where: {
          propertyId: session.propertyId,
          tierId: unit.tierId,
          isActive: true,
        },
      });

      await tx.propertyTier.update({
        where: { id: unit.tierId },
        data: { activeUnitCount: activeTierUnitCount },
      });
    }

    return updated;
  },
  { isolationLevel: "ReadCommitted" }
);

    return NextResponse.json({ ok: true, unit: result });
  } catch (err) {
    const businessErrors = new Map<string, number>([
      ["Unauthorized", 401],
      ["Forbidden", 403],
      ["Unit not found", 404],
      ["Tier does not belong to property.", 404],
      ["Cannot inactivate an occupied unit", 400],
      ["Max number of units have been activated for this tier.", 400],
    ]);
    const expectedStatus = err instanceof Error ? businessErrors.get(err.message) : undefined;
    const message = expectedStatus !== undefined && err instanceof Error ? err.message : "Server error";
    const status = expectedStatus ?? 500;

    if (expectedStatus === undefined) {
      // Retain diagnostic classification without logging SQL, credentials, or raw messages.
      const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
      console.error("toggle unit active internal error", {
        code: typeof code === "string" && /^(P\d{4}|[0-9A-Z]{5})$/.test(code) ? code : "UNKNOWN",
      });
    }

    return NextResponse.json({ error: message }, { status });
  }
}
