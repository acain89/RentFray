import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ResolveRequestBody = {
  code?: string;
  propertyCode?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ResolveRequestBody>;

    const propertyCode = String(body.code ?? body.propertyCode ?? "").trim();

    if (!/^\d{4,5}$/.test(propertyCode)) {
      return NextResponse.json(
        { error: "Valid 4 or 5 digit property code required" },
        { status: 400 }
      );
    }

    const property = await prisma.property.findFirst({
  where: {
    propertyCode,
  },
  select: {
    id: true,
    name: true,
    propertyCode: true,
    tiers: {
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        baseRentCents: true,
      },
    },
  },
});

    if (!property) {
      return NextResponse.json(
        { error: "Invalid property code" },
        { status: 404 }
      );
    }

    type PropertyTier = (typeof property.tiers)[number];

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        propertyCode: property.propertyCode,
      },
      tiers: property.tiers.map((tier: PropertyTier) => ({
        id: tier.id,
        name: tier.name,
        baseRentCents: tier.baseRentCents,
      })),
    });
  } catch (error: unknown) {
    console.error("PROPERTY_RESOLVE_ERROR:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
