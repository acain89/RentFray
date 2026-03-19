import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toCSV(rows: Record<string, any>[]) {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);

  const escape = (value: any) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.join(",");
  const lines = rows.map((row) =>
    headers.map((h) => escape(row[h])).join(",")
  );

  return [headerLine, ...lines].join("\n");
}

function fmtDate(value: Date | string | null) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const propertyId = searchParams.get("propertyId");
    const unitId = searchParams.get("unitId");

    if (!propertyId && !unitId) {
      return NextResponse.json(
        { error: "propertyId or unitId required" },
        { status: 400 }
      );
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        ...(unitId ? { unitId } : {}),
      },
      orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
      include: {
        unit: true,
        tenant: true,
        property: true,
      },
    });

    let runningBalance = 0;

    const rows = entries.map((e) => {
      runningBalance += Number(e.amount || 0);

      return {
        propertyName: e.property?.name || "",
        propertyCode: e.property?.code || "",
        unitNumber: e.unit?.unitNumber || "",
        tenantName: e.tenant?.name || "",

        type: e.type,
        amount: Number(e.amount || 0),
        runningBalance,

        effectiveDate: fmtDate(e.effectiveDate),
        createdAt: fmtDate(e.createdAt),

        memo: e.memo || "",
        source: e.source || "",
      };
    });

    const csv = toCSV(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="ledger-export.csv"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to export ledger" },
      { status: 500 }
    );
  }
}