import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitFinancialState } from "@/lib/unitFinancialState";
import { formatCentsToDollars } from "@/lib/billingConfig";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type CsvValue = string | number | null;
type CsvRow = Record<string, CsvValue>;

function toCSV(rows: CsvRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);

  const escape = (value: CsvValue): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.join(",");
  const lines = rows.map((row) =>
    headers.map((h) => escape(row[h] ?? null)).join(",")
  );

  return [headerLine, ...lines].join("\n");
}

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().split("T")[0] ?? "";
}

function parseBillingCycleInput(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{2}\/\d{4}$/.test(trimmed)) {
    const [month, year] = trimmed.split("/");
    return `${year}-${month}`;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const session = await getSession();

    if (
      !session ||
      (session.role !== "OWNER" &&
        session.role !== "MANAGER" &&
        session.role !== "STAFF") ||
      !session.propertyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const propertyId = session.propertyId;
    const { searchParams } = new URL(req.url);
    const requestedPropertyId = searchParams.get("propertyId");
    const requestedCycle =
      searchParams.get("month") ??
      searchParams.get("billingCycle") ?? searchParams.get("cycle");
    const unitSearch = searchParams.get("unit");

    if (requestedPropertyId && requestedPropertyId !== session.propertyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const billingCycle = parseBillingCycleInput(requestedCycle);

    if (requestedCycle && !billingCycle) {
      return NextResponse.json(
        { error: "Invalid billingCycle. Use YYYY-MM or MM/YYYY." },
        { status: 400 }
      );
    }

    const units = await prisma.unit.findMany({
      where: {
  propertyId: session.propertyId,
  isActive: true,
  ...(unitSearch ? { unitNumber: { contains: unitSearch, mode: "insensitive" as const } } : {}),
       },
      orderBy: { unitNumber: "asc" },
      include: {
        property: {
          select: {
            name: true,
            propertyCode: true,
            rentFrayStartDate: true,
            settings: true,
          },
        },
        tier: {
          select: {
            name: true,
            baseRentCents: true,
            id: true,
            rentDueDay: true,
            gracePeriodDays: true,
            lateFeeInitialCents: true,
            lateFeeDailyCents: true,
            maxLateFeeDays: true,
          },
        },
        tenantAssignments: {
          where: {
            isCurrent: true,
            moveOutDate: null,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            moveInDate: true,
          },
        },
      },
    });

    type UnitWithRelations = (typeof units)[number];

    const rows: CsvRow[] = await Promise.all(
      units.map(async (unit: UnitWithRelations) => {
        const currentAssignment = unit.tenantAssignments?.[0] ?? null;

        const now = new Date();
        // Current state belongs only to the current tenancy, as on Unit Detail.
        const state = currentAssignment
          ? await getUnitFinancialState({
              propertyId: propertyId,
              unitId: unit.id,
              tenantAssignmentId: currentAssignment.id,
              tier: unit.tier,
              propertySettings: unit.property.settings,
              rentFrayStartDate: unit.property.rentFrayStartDate,
              now,
            })
          : null;
        const summary = state?.ledgerSummary;

        // Period totals belong to the unit, including all historical assignments
        // and legacy unassigned entries. billingCycle is the stored financial
        // period identity; effectiveDate prevents future obligations counting now.
        const cycleEntries = billingCycle
          ? await prisma.ledgerEntry.findMany({
              where: {
                propertyId: session.propertyId,
                unitId: unit.id,
                billingCycle,
                voidedAt: null,
                effectiveDate: { lte: now },
              },
              include: { payment: { select: { status: true } } },
            })
          : [];
        let periodChargesCents = 0;
        let periodPaidCents = 0;
        let periodCreditsCents = 0;
        let periodAdjustmentsCents = 0;
        for (const entry of cycleEntries) {
          switch (entry.entryType) {
            case "CHARGE":
              periodChargesCents += Math.abs(entry.amountCents);
              break;
            case "PAYMENT":
              if (entry.payment?.status === "PAID") {
                periodPaidCents += Math.abs(entry.amountCents);
              }
              break;
            case "CREDIT":
              periodCreditsCents += Math.abs(entry.amountCents);
              break;
            case "ADJUSTMENT":
              periodAdjustmentsCents += entry.amountCents;
              break;
          }
        }
        const periodNetCents = periodChargesCents - periodPaidCents -
          periodCreditsCents + periodAdjustmentsCents;
        const currentBalanceCents = state?.ledgerBalanceCents ?? 0;
        // Payable principal excludes convenience fees and is suppressed while pending.
        const amountDueNowCents = state?.hasPendingPayment ? 0 : currentBalanceCents;

        const tenantName = `${currentAssignment?.firstName ?? ""} ${
          currentAssignment?.lastName ?? ""
        }`.trim();

        const occupancyStatus = currentAssignment ? "OCCUPIED" : "VACANT";
        const marketRentCents = unit.tier?.baseRentCents ?? 0;

        return {
          propertyName: unit.property?.name ?? "",
          propertyCode: unit.property?.propertyCode ?? "",
          billingCycle: billingCycle ?? "",
          unitNumber: unit.unitNumber ?? "",
          tenantName: tenantName || "",
          occupancyStatus,
          tierName: unit.tier?.name ?? "",
          marketRentCents,
          marketRent: formatCentsToDollars(marketRentCents),
          currentBalanceCents: currentBalanceCents,
          currentBalance: formatCentsToDollars(currentBalanceCents),
          totalChargesCents: (summary?.totalChargesCents ?? 0),
          totalCharges: formatCentsToDollars((summary?.totalChargesCents ?? 0)),
          totalPaidCents: (summary?.totalPaidCents ?? 0),
          totalPaid: formatCentsToDollars((summary?.totalPaidCents ?? 0)),
          lastPaymentDate: fmtDate(summary?.lastPaymentDate),
          lastPaymentAmountCents: summary?.lastPaymentAmountCents ?? 0,
          lastPaymentAmount:
            summary?.lastPaymentAmountCents == null
              ? ""
              : formatCentsToDollars(summary?.lastPaymentAmountCents),
          amountDueNowCents: amountDueNowCents,
          amountDueNow: formatCentsToDollars(
            amountDueNowCents
          ),
          dueDate: state?.dueDate ?? "",
          graceEndsOn: state?.graceEndsOn ?? "",
          isDelinquent: state?.isDelinquent ? "YES" : "NO",
          daysPastDue: state?.daysPastDue ?? 0,
          moveInDate: fmtDate(currentAssignment?.moveInDate),
          currentBillingCycle: state?.billingCycle ?? "",
          currentStatus: state?.status.status ?? "VACANT",
          currentPending: state?.hasPendingPayment ? "YES" : "NO",
          currentGrace: state?.isWithinGracePeriod ? "YES" : "NO",
          periodChargesCents: billingCycle ? periodChargesCents : null,
          periodCharges: billingCycle ? formatCentsToDollars(periodChargesCents) : "",
          periodPaidCents: billingCycle ? periodPaidCents : null,
          periodPaid: billingCycle ? formatCentsToDollars(periodPaidCents) : "",
          periodCreditsCents: billingCycle ? periodCreditsCents : null,
          periodCredits: billingCycle ? formatCentsToDollars(periodCreditsCents) : "",
          periodAdjustmentsCents: billingCycle ? periodAdjustmentsCents : null,
          periodAdjustments: billingCycle ? formatCentsToDollars(periodAdjustmentsCents) : "",
          periodNetCents: billingCycle ? periodNetCents : null,
          periodNet: billingCycle ? formatCentsToDollars(periodNetCents) : "",
        };
      })
    );

    const cycleLabel = billingCycle ?? "all-cycles";
    const csv = toCSV(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=balances-export-${cycleLabel}.csv`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("Failed to export balances", err);
    return NextResponse.json(
      { error: "Failed to export balances" },
      { status: 500 }
    );
  }
}
