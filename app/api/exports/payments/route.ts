// app/api/exports/payments/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  const escape = (value: unknown): string => {
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

function fmtDate(value: Date | string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const propertyId = searchParams.get("propertyId");
    const status = searchParams.get("status");

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId required" },
        { status: 400 }
      );
    }

    const payments = await prisma.payment.findMany({
      where: {
        propertyId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        unit: true,
      },
    });

    const rows = payments.map((p) => ({
      unitNumber: p.unit?.unitNumber || "",
      status: p.status,
      amount: Math.abs(p.amountCents) / 100,
      createdAt: fmtDate(p.createdAt),
      updatedAt: fmtDate(p.updatedAt),
    }));

    const csv = toCSV(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=payments-report.csv",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}