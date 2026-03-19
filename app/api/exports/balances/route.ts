import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

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
  const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(","));

  return [headerLine, ...lines].join("\n");
}

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId required" },
        { status: 400 }
      );
    }

    const units = await prisma.unit.findMany({
      where: { propertyId },
      orderBy: { unitNumber: "asc" },
      include: {
        assignments: {
          where: { moveOut: null },
          orderBy: { moveIn: "desc" },
          include: { tenant: true },
        },
        property: true,
      },
    });

    const rows = await Promise.all(
      units.map(async (unit) => {
        const summary = await getUnitLedgerSummary(unit.id);
        const delinquency = await getUnitDelinquencySummary(unit.id);

        return {
          propertyName: unit.property?.name || "",
          propertyCode: unit.property?.code || "",
          unitNumber: unit.unitNumber,
          tenantName: unit.assignments[0]?.tenant?.name || "",
          occupancyStatus: unit.occupancyStatus,
          marketRent: Number(unit.marketRent || 0),
          currentBalance: Number(summary.balance || 0),
          totalCharges: Number(summary.totalCharges || 0),
          totalPaid: Number(summary.totalPaid || 0),
          lastPaymentDate: fmtDate(summary.lastPaymentDate),
          lastPaymentAmount: Number(summary.lastPaymentAmount || 0),
          amountDueNow: Number(delinquency.amountDueNow || 0),
          dueDate: fmtDate(delinquency.dueDate),
          graceEndsOn: fmtDate(delinquency.graceEndsOn),
          isDelinquent: delinquency.isDelinquent ? "YES" : "NO",
        };
      })
    );

    const csv = toCSV(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="balances-export.csv"',
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to export balances" },
      { status: 500 }
    );
  }
}