import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  getRentDateSummary,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";
import { formatCentsToDollars } from "@/lib/billingConfig";
import { getCapacitySnapshot } from "@/lib/propertyCapacity";
import { shouldAutoSetPropertyReady } from "@/lib/propertyStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";
type LedgerEntryType = "CHARGE" | "PAYMENT" | "CREDIT" | "ADJUSTMENT";

type LedgerSummary = {
  balanceCents: number;
  totalChargesCents: number;
  totalCreditsCents: number;
  totalPaidCents: number;
};

type ExportMonthOption = {
  value: string;
  label: string;
  year: number;
  month: number;
};

function buildExportMonths(
  startDateValue: Date | string | null | undefined
): ExportMonthOption[] {
  const fallback = new Date();
  const parsed =
    startDateValue instanceof Date
      ? startDateValue
      : startDateValue
        ? new Date(startDateValue)
        : fallback;

  const safeStart = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  const now = new Date();

  const start = new Date(safeStart.getFullYear(), safeStart.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  const months: ExportMonthOption[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;

    months.push({
      value: `${year}-${String(month).padStart(2, "0")}`,
      label: cursor.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      year,
      month,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months.reverse();
}

function getNextCycleKey(cycleKey: string): string {
  const [yearRaw, monthRaw] = cycleKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function normalizeLedgerEntryType(value: unknown): LedgerEntryType | null {
  const type = String(value ?? "").trim().toUpperCase();

  switch (type) {
    case "CHARGE":
    case "PAYMENT":
    case "CREDIT":
    case "ADJUSTMENT":
      return type;
    default:
      return null;
  }
}

function normalizePaymentStatus(value: unknown): PaymentStatus | null {
  const status = String(value ?? "").trim().toUpperCase();

  switch (status) {
    case "UNPAID":
    case "PENDING":
    case "PAID":
    case "FAILED":
    case "REVERSED":
      return status;
    default:
      return null;
  }
}

function toSafeInteger(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDays(later: Date, earlier: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(
    0,
    Math.floor((later.getTime() - earlier.getTime()) / msPerDay)
  );
}

function getLedgerImpactCents(input: {
  entryType: LedgerEntryType;
  amountCents: number;
  paymentStatus: PaymentStatus | null;
}): number {
  const absAmount = Math.abs(toSafeInteger(input.amountCents));

  if (input.entryType === "CHARGE") return absAmount;
  if (input.entryType === "PAYMENT") {
    return input.paymentStatus === "PAID" ? -absAmount : 0;
  }
  if (input.entryType === "CREDIT") return -absAmount;
  if (input.entryType === "ADJUSTMENT") return toSafeInteger(input.amountCents);

  return 0;
}

function getBillingLabel(cycleKey: string): string {
  const [yearRaw, monthRaw] = cycleKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return cycleKey;

  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export async function GET() {
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

    const property = await prisma.property.findUnique({
      where: { id: session.propertyId },
      include: {
        settings: true,
        paymentStatus: true,
        units: {
          select: {
            id: true,
          },
        },
        managementUsers: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            email: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    let bankStatus: "NOT_CONNECTED" | "PENDING" | "CONNECTED" | "RESTRICTED" =
      "NOT_CONNECTED";
    let bankMessage =
      "Connect your payout account to begin receiving payments.";

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const stripe = secretKey
      ? new Stripe(secretKey, {
          apiVersion: "2026-02-25.clover",
        })
      : null;

    if (property.stripeAccountId && stripe) {
      try {
        const account = await stripe.accounts.retrieve(property.stripeAccountId);

        if (account.charges_enabled && account.payouts_enabled) {
          bankStatus = "CONNECTED";
          bankMessage =
            "Your account has been successfully connected. Payments received will be deposited into the connected account.";
        } else if (account.requirements?.disabled_reason) {
          bankStatus = "RESTRICTED";
          bankMessage =
            "Sorry, your account could not be fully verified. Please complete all required Stripe onboarding steps.";
        } else {
          bankStatus = "PENDING";
          bankMessage =
            "Your account is pending verification. This can take anywhere from a couple of minutes to a few hours. Please check back later.";
        }
      } catch (err) {
        console.error("Stripe account fetch error:", err);
        bankStatus = "RESTRICTED";
        bankMessage = "Unable to verify Stripe account status. Please try again.";
      }
    }

    if (
      shouldAutoSetPropertyReady({
        currentStatus: property.status,
        isActive: property.isActive,
        hasSettings: Boolean(property.settings),
        unitsCount: Array.isArray(property.units) ? property.units.length : 0,
        processorConnected: property.paymentStatus?.processorConnected,
        chargesEnabled: property.paymentStatus?.chargesEnabled,
        payoutsEnabled: property.paymentStatus?.payoutsEnabled,
      })
    ) {
      await prisma.property.update({
        where: { id: property.id },
        data: { status: "READY" },
      });

      property.status = "READY";
    }

    const capacity = await getCapacitySnapshot(property.id);

    const units = await prisma.unit.findMany({
      where: {
        propertyId: property.id,
        isActive: true,
      },
      orderBy: { unitNumber: "asc" },
      select: {
        id: true,
        unitNumber: true,
        isActive: true,
        tier: {
          select: {
            id: true,
            name: true,
            rentDueDay: true,
            gracePeriodDays: true,
            lateFeeInitialCents: true,
            lateFeeDailyCents: true,
            maxLateFeeDays: true,
          },
        },
        tenantAssignments: {
          where: { isCurrent: true, moveOutDate: null },
          orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const now = new Date();
    const today = toDateOnly(now);
    const billingStart = property.billingCycleStartDate
      ? new Date(property.billingCycleStartDate)
      : null;

    const anchorUnit = units[0] ?? null;
    const anchorEffective = resolveEffectiveBillingSettings({
      tier: anchorUnit?.tier ?? null,
      propertySettings: property.settings ?? null,
    });
    const anchorRentDates = getRentDateSummary({
      ...anchorEffective,
      now,
    });

    const currentBillingCycle = anchorRentDates.billingCycle;
    const nextBillingCycle = getNextCycleKey(currentBillingCycle);
    const billingLabel = getBillingLabel(currentBillingCycle);

       type DashboardUnit = (typeof units)[number];
       type DashboardPaymentRow = (typeof payments)[number];
       type DashboardLedgerEntryRow = (typeof ledgerEntries)[number];
       type DashboardNextCycleEntryRow = (typeof nextCycleEntries)[number];

    const unitIds = units.map((unit: DashboardUnit) => unit.id);

    const [ledgerEntries, payments, nextCycleEntries] =
      unitIds.length > 0
        ? await Promise.all([
            prisma.ledgerEntry.findMany({
              where: {
                propertyId: property.id,
                unitId: { in: unitIds },
                voidedAt: null,
                effectiveDate: {
                  lte: now,
                },
              },
              orderBy: [
                { effectiveDate: "asc" },
                { createdAt: "asc" },
                { id: "asc" },
              ],
              select: {
                id: true,
                propertyId: true,
                unitId: true,
                tenantAssignmentId: true,
                paymentId: true,
                billingCycle: true,
                entryType: true,
                chargeType: true,
                amountCents: true,
                effectiveDate: true,
                createdAt: true,
                memo: true,
                payment: {
                  select: {
                    status: true,
                  },
                },
              },
            }),
            prisma.payment.findMany({
              where: {
                propertyId: property.id,
                unitId: { in: unitIds },
              },
              select: {
                id: true,
                unitId: true,
                tenantAssignmentId: true,
                billingCycle: true,
                amountCents: true,
                status: true,
                paymentMethod: true,
              },
            }),
            prisma.ledgerEntry.findMany({
              where: {
                propertyId: property.id,
                unitId: { in: unitIds },
                billingCycle: nextBillingCycle,
                entryType: {
                  in: ["CHARGE", "CREDIT"],
                },
                voidedAt: null,
              },
              orderBy: [{ createdAt: "desc" }],
              select: {
                id: true,
                unitId: true,
                tenantAssignmentId: true,
                entryType: true,
                chargeType: true,
                amountCents: true,
                memo: true,
                effectiveDate: true,
                createdAt: true,
                billingCycle: true,
              },
            }),
          ])
        : [[], [], []];

    const ledgerByUnit = new Map<string, typeof ledgerEntries>();
    const paymentsByUnit = new Map<string, typeof payments>();
    const nextEntriesByUnit = new Map<string, typeof nextCycleEntries>();

    for (const entry of ledgerEntries) {
      const existing = ledgerByUnit.get(entry.unitId) ?? [];
      existing.push(entry);
      ledgerByUnit.set(entry.unitId, existing);
    }

    for (const payment of payments) {
      const existing = paymentsByUnit.get(payment.unitId) ?? [];
      existing.push(payment);
      paymentsByUnit.set(payment.unitId, existing);
    }

    for (const entry of nextCycleEntries) {
      const existing = nextEntriesByUnit.get(entry.unitId) ?? [];
      existing.push(entry);
      nextEntriesByUnit.set(entry.unitId, existing);
    }

    let occupiedUnits = 0;
    let totalExpectedCents = 0;
    let totalCollectedCents = 0;
    let delinquentCount = 0;
    let unpaidUnitsCount = 0;
    let portalPaidCount = 0;
    let manualPaidCount = 0;
    let totalPaidCount = 0;

        const resolvedUnits = units.map((unit: DashboardUnit) => {
      const assignment = unit.tenantAssignments[0] ?? null;

      if (!assignment) {
        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          isActive: unit.isActive === true,
          tenantName: null,
          balanceCents: 0,
          balance: "0.00",
          totalPaid: "0.00",
          isDelinquent: false,
          daysPastDue: 0,
          paymentStatus: "UNPAID" as PaymentStatus,
          tierName: unit.tier?.name ?? "Units",
        };
      }

      occupiedUnits++;

      const unitLedgerEntries = ledgerByUnit.get(unit.id) ?? [];
      const unitPayments = paymentsByUnit.get(unit.id) ?? [];
      const unitNextEntries = nextEntriesByUnit.get(unit.id) ?? [];

      const ledger: LedgerSummary = {
        balanceCents: 0,
        totalChargesCents: 0,
        totalCreditsCents: 0,
        totalPaidCents: 0,
      };

      const effective = resolveEffectiveBillingSettings({
        tier: unit.tier,
        propertySettings: property.settings,
      });

      const rentDates = getRentDateSummary({
        ...effective,
        now,
      });


      let rentChargesCents = 0;

      let currentCycleBalanceCents = 0;

      for (const entry of unitLedgerEntries) {
        if (
          entry.tenantAssignmentId &&
          entry.tenantAssignmentId !== assignment.id
        ) {
          continue;
        }

        const entryType = normalizeLedgerEntryType(entry.entryType);
        if (!entryType) continue;

        const effectiveDate = entry.effectiveDate;
        const shouldHidePreStartCharge =
          Boolean(billingStart) &&
          entryType === "CHARGE" &&
          effectiveDate < billingStart!;

        if (shouldHidePreStartCharge) continue;

        const rawAmountCents = toSafeInteger(entry.amountCents);
        const paymentStatus = normalizePaymentStatus(entry.payment?.status);

        const impactCents = getLedgerImpactCents({
  entryType,
  amountCents: rawAmountCents,
  paymentStatus,
});

ledger.balanceCents += impactCents;

if (entry.billingCycle === rentDates.billingCycle) {
  currentCycleBalanceCents += impactCents;
}

        if (entryType === "CHARGE") {
          ledger.totalChargesCents += Math.abs(rawAmountCents);

          if (entry.chargeType === "RENT") {
            rentChargesCents += Math.abs(rawAmountCents);
          }
        }

        if (entryType === "CREDIT") {
          ledger.totalCreditsCents += Math.abs(rawAmountCents);
        }

        if (entryType === "PAYMENT" && paymentStatus === "PAID") {
          ledger.totalPaidCents += Math.abs(rawAmountCents);
        }
      }

     
      const dueDate = parseDateOnly(rentDates.dueDate);
    const isDelinquent =
  currentCycleBalanceCents > 0 &&
  rentDates.isDelinquent &&
  dueDate !== null;

      const daysPastDue =
        isDelinquent && dueDate ? diffDays(today, dueDate) : 0;

      const cyclePayments = unitPayments.filter(
          (payment: DashboardPaymentRow) =>
          payment.tenantAssignmentId === assignment.id &&
          payment.billingCycle === rentDates.billingCycle
      );

      const paidCyclePayments = cyclePayments.filter(
  (payment: DashboardPaymentRow) => payment.status === "PAID"
);

      const netExpected = ledger.totalChargesCents - ledger.totalCreditsCents;
      totalExpectedCents += Math.max(0, netExpected);

      const cyclePaidCents = paidCyclePayments.reduce(
        (sum: number, payment: DashboardPaymentRow) =>
  sum + Math.max(0, toSafeInteger(payment.amountCents)),
        0
      );

      totalCollectedCents += cyclePaidCents;

      if (isDelinquent) {
        delinquentCount++;
      }

      if (currentCycleBalanceCents > 0) {
        unpaidUnitsCount++;
      } else {
        totalPaidCount++;

        const hasManual = paidCyclePayments.some(
          (payment: DashboardPaymentRow) => payment.paymentMethod === "MANUAL"
        );
        const hasPortal = paidCyclePayments.some(
          (payment: DashboardPaymentRow) => payment.paymentMethod === "ACH"
        );

        if (hasManual) manualPaidCount++;
        else if (hasPortal) portalPaidCount++;
      }

      let paymentStatus: PaymentStatus = "UNPAID";

      const hasPending = cyclePayments.some(
        (payment: DashboardPaymentRow) => payment.status === "PENDING"
      );
      const hasFailed = cyclePayments.some(
        (payment: DashboardPaymentRow) => payment.status === "FAILED"
      );
      const hasReversed = cyclePayments.some(
        (payment: DashboardPaymentRow) => payment.status === "REVERSED"
      );

      if (currentCycleBalanceCents <= 0) {
        paymentStatus = "PAID";
      } else if (hasReversed || hasFailed) {
        paymentStatus = "FAILED";
      } else if (hasPending) {
        paymentStatus = "PENDING";
      }

      return {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        isActive: unit.isActive === true,
        tenantName: `${assignment.firstName ?? ""} ${
          assignment.lastName ?? ""
        }`.trim(),
        balanceCents: ledger.balanceCents,
        balance: formatCentsToDollars(ledger.balanceCents),
        totalPaid: formatCentsToDollars(ledger.totalPaidCents),
        isDelinquent,
        daysPastDue,
        paymentStatus,
        tierName: unit.tier?.name ?? "Units",
       nextCycleAdjustments: unitNextEntries
  .filter(
    (entry: DashboardNextCycleEntryRow) =>
      !entry.tenantAssignmentId ||
      entry.tenantAssignmentId === assignment.id
  )
  .map((entry: DashboardNextCycleEntryRow) => ({
            id: entry.id,
            type: entry.entryType,
            chargeType: entry.chargeType,
            amount: entry.amountCents / 100,
            memo: entry.memo,
            effectiveDate: entry.effectiveDate.toISOString(),
            createdAt: entry.createdAt.toISOString(),
            billingCycle: entry.billingCycle,
          })),
      };
    });

    const totalExpected = Math.round(totalExpectedCents) / 100;
    const totalCollected = Math.round(totalCollectedCents) / 100;
    const exportMonths = buildExportMonths(property.billingCycleStartDate);

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        code: property.propertyCode,
        unitCount: capacity.effectiveUnitCount,
        managementUsers: property.managementUsers,
        billingCycleStartDate: property.billingCycleStartDate
          ? property.billingCycleStartDate.toISOString()
          : null,
        paymentStatus: {
          bankConnected: bankStatus === "CONNECTED",
          bankStatus,
          bankMessage,
        },
      },
      session: {
        role: session.role,
      },
      summary: {
        totalUnits: capacity.effectiveUnitCount,
        occupiedUnits,
        vacantUnits: Math.max(0, capacity.effectiveUnitCount - occupiedUnits),
        delinquentUnits: delinquentCount,
      },
      financials: {
        expected: totalExpected,
        collected: totalCollected,
        collectionRate:
          totalExpected > 0
            ? Math.round((totalCollected / totalExpected) * 100)
            : 0,
      },
      cycleSnapshot: {
        billingCycleLabel: billingLabel,
        occupiedUnitsLabel: `${occupiedUnits} / ${capacity.effectiveUnitCount}`,
        portalPaidCount,
        manualPaidCount,
        totalPaidCount,
        unpaidUnitsCount,
        totalCollected,
        totalExpected,
        collectionRate:
          totalExpected > 0
            ? Number(((totalCollected / totalExpected) * 100).toFixed(1))
            : 0,
        difference: totalCollected - totalExpected,
      },
      units: resolvedUnits,
      exportOptions: {
        months: exportMonths,
        startYear: exportMonths[exportMonths.length - 1]?.year ?? null,
        startMonth: exportMonths[exportMonths.length - 1]?.month ?? null,
        currentYear: exportMonths[0]?.year ?? null,
        currentMonth: exportMonths[0]?.month ?? null,
      },
    });
  } catch (error) {
    console.error("dashboard error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}