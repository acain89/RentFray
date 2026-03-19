import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = String(searchParams.get("propertyId") || "").trim();

    const requests = await prisma.maintenanceRequest.findMany({
      where: propertyId ? { propertyId } : undefined,
      include: {
        property: true,
        unit: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json({
      ok: true,
      requests: requests.map((r) => ({
        id: r.id,
        propertyId: r.propertyId,
        propertyName: r.property?.name || "Unknown Property",
        unitId: r.unitId,
        unitNumber: r.unit?.unitNumber || "Unknown Unit",
        tenantId: r.tenantId,
        category: r.category,
        urgency: r.urgency,
        status: r.status,
        description: r.description,
        internalNotes: r.internalNotes || "",
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load maintenance queue" },
      { status: 500 }
    );
  }
}