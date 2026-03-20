import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateUniquePropertyCode } from "@/lib/propertyCode";

function clean(value: unknown) {
  return String(value || "").trim();
}

function toMoneyNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toOptionalInt(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const properties = await prisma.property.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        settings: true,
        _count: {
          select: {
            units: true,
            managementUsers: true,
            maintenanceUsers: true,
            maintenanceRequests: true,
            ledgerEntries: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, properties });
  } catch (error) {
    console.error("GET /api/admin/properties error:", error);
    return NextResponse.json({ error: "Failed to load properties" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const name = clean(body.name);
    const legalName = clean(body.legalName);
    const address1 = clean(body.address1);
    const address2 = clean(body.address2);
    const city = clean(body.city);
    const state = clean(body.state).toUpperCase();
    const zip = clean(body.zip);
    const phone = clean(body.phone);
    const email = clean(body.email).toLowerCase();

    const unitCount = toOptionalInt(body.unitCount);
    const baseRent = toMoneyNumber(body.baseRent);
    const convenienceFee = toMoneyNumber(body.convenienceFee);

    if (!name) {
      return NextResponse.json({ error: "Property name is required" }, { status: 400 });
    }

    if (state && state.length !== 2) {
      return NextResponse.json({ error: "State must be 2 letters" }, { status: 400 });
    }

    if (unitCount !== null && unitCount < 0) {
      return NextResponse.json({ error: "Unit count is invalid" }, { status: 400 });
    }

    if (baseRent < 0) {
      return NextResponse.json({ error: "Base rent cannot be negative" }, { status: 400 });
    }

    if (convenienceFee < 0) {
      return NextResponse.json({ error: "Convenience fee cannot be negative" }, { status: 400 });
    }

    const code = await generateUniquePropertyCode();

    const property = await prisma.property.create({
      data: {
        name,
        code,
        status: "SETUP",
        legalName: legalName || null,
        address1: address1 || null,
        address2: address2 || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        phone: phone || null,
        email: email || null,
        settings: {
          create: {
            baseRentDefault: baseRent,
            convenienceFee,
          },
        },
        auditLogs: {
          create: {
            actorRole: "ADMIN",
            actorLabel: session.adminAccessId || "admin",
            action: "PROPERTY_CREATED",
            entityType: "PROPERTY",
            entityId: "",
            notes: JSON.stringify({
              propertyName: name,
              propertyCode: code,
              unitCount,
              baseRent,
              convenienceFee,
            }),
          },
        },
      },
      include: {
        settings: true,
      },
    });

    await prisma.auditLog.updateMany({
      where: {
        entityId: "",
        entityType: "PROPERTY",
        action: "PROPERTY_CREATED",
        actorRole: "ADMIN",
      },
      data: {
        entityId: property.id,
      },
    });

    return NextResponse.json({
      ok: true,
      property,
    });
  } catch (error) {
    console.error("POST /api/admin/properties error:", error);
    return NextResponse.json({ error: "Failed to create property" }, { status: 500 });
  }
}