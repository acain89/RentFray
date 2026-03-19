import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAYMENT_TYPES = new Set(["MANUAL_PAYMENT", "PAYMENT"]);

function labelForType(type: string) {
  switch (type) {
    case "MANUAL_PAYMENT":
      return "Manual Payment";
    case "PAYMENT":
      return "Online Payment";
    default:
      return type;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const unitId = String(body.unitId || "").trim();

    if (!unitId) {
      return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: true,
        assignments: {
          where: { moveOut: null },
          orderBy: { moveIn: "desc" },
          include: { tenant: true },
        },
        ledgerEntries: {
          where: {
            type: {
              in: ["MANUAL_PAYMENT", "PAYMENT"],
            },
          },
          orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const activeAssignment = unit.assignments[0] ?? null;
    const activeTenant = activeAssignment?.tenant ?? null;

    if (!activeTenant) {
      return NextResponse.json(
        { error: "No active tenant for unit" },
        { status: 400 }
      );
    }

    const moveInDate = new Date(activeAssignment.moveIn).getTime();

    const payments = unit.ledgerEntries
      .filter((entry) => {
        const entryDate = new Date(entry.effectiveDate).getTime();
        const sameTenantOrUnitLevel =
          !entry.tenantId || entry.tenantId === activeTenant.id;

        return (
          PAYMENT_TYPES.has(entry.type) &&
          Number(entry.amount) < 0 &&
          entryDate >= moveInDate &&
          sameTenantOrUnitLevel
        );
      })
      .map((entry) => ({
        id: entry.id,
        type: entry.type,
        label: labelForType(entry.type),
        amount: Math.abs(Number(entry.amount || 0)),
        effectiveDate: entry.effectiveDate,
        memo: entry.memo,
        source: entry.source,
      }));

    return NextResponse.json({
      ok: true,
      tenantName: activeTenant.name,
      propertyName: unit.property?.name || "",
      propertyCode: unit.property?.code || "",
      unitNumber: unit.unitNumber,
      payments,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load payment history" },
      { status: 500 }
    );
  }
}