// [path: app/api/manager/maintenance/route.ts]

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (
      !session ||
      !["OWNER", "MANAGER", "STAFF"].includes(session.role) ||
      !session.propertyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        propertyId: session.propertyId,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        unit: {
          select: {
            unitNumber: true,
            tenantAssignments: {
              where: {
                isCurrent: true,
                moveOutDate: null,
              },
              orderBy: { moveInDate: "desc" },
              take: 1,
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
        requests: requests.map((row: any) => {
        const assignment = row.unit.tenantAssignments[0] ?? null;

        const tenantName = assignment
          ? [assignment.firstName, assignment.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() || null
          : null;

        return {
          id: row.id,
          unitNumber: row.unit.unitNumber,
          tenantName,
          category: row.category,
          urgency: row.urgency,
          status: row.status,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/manager/maintenance error:", error);
    return NextResponse.json({ error: "Failed to load maintenance" }, { status: 500 });
  }
}