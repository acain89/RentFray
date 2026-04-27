import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { getRentDateSummary, resolveEffectiveBillingSettings } from "@/lib/rentDates";
import { formatCentsToDollars } from "@/lib/billingConfig";
import { getCapacitySnapshot } from "@/lib/propertyCapacity";
import Stripe from "stripe";
import { shouldAutoSetPropertyReady } from "@/lib/propertyStatus";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

function buildExportMonths(startDateValue: Date | string | null | undefined) {
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

  const months: {
    value: string;
    label: string;
    year: number;
    month: number;
  }[] = [];

  let cursor = new Date(start);

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
    units: true,
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

function getNextCycleKey(cycleKey: string): string {
  const [yearRaw, monthRaw] = cycleKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

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
    bankMessage =
      "Unable to verify Stripe account status. Please try again.";
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

    /**
     * 🔑 CRITICAL FIX:
     * ONLY pull units that ACTUALLY HAVE TENANTS
     */
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
            name: true,
          },
        },
        tenantAssignments: {
          where: { isCurrent: true, moveOutDate: null },
          take: 1,
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    let occupiedUnits = 0;
let totalExpectedCents = 0;
let totalCollectedCents = 0;
let delinquentCount = 0;
let unpaidUnitsCount = 0;
let portalPaidCount = 0;
let manualPaidCount = 0;
let totalPaidCount = 0;

    const resolvedUnits = await Promise.all(
      units.map(async (unit: (typeof units)[number]) => {
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
    paymentStatus: "UNPAID",
    tierName: unit.tier?.name ?? "Units",
  };
}

        occupiedUnits++;

        const [ledger, delinquency] = await Promise.all([
  getUnitLedgerSummary(unit.id, assignment.id),
  getUnitDelinquencySummary(unit.id),
]);

const effective = resolveEffectiveBillingSettings({
  tier: unit.tier,
  propertySettings: property.settings,
});

const rentDates = getRentDateSummary({
  ...effective,
  now: new Date(),
});

const nextBillingCycle = getNextCycleKey(rentDates.billingCycle);

const nextCycleAdjustments = await prisma.ledgerEntry.findMany({
  where: {
    propertyId: property.id,
    unitId: unit.id,
    tenantAssignmentId: assignment.id,
    billingCycle: nextBillingCycle,
    entryType: {
      in: ["CHARGE", "CREDIT"],
    },
    voidedAt: null,
  },
  orderBy: [{ createdAt: "desc" }],
  select: {
    id: true,
    entryType: true,
    chargeType: true,
    amountCents: true,
    memo: true,
    effectiveDate: true,
    createdAt: true,
    billingCycle: true,
  },
});

const payments = await prisma.payment.findMany({
  where: {
    unitId: unit.id,
    tenantAssignmentId: assignment.id,
    status: "PAID",
    billingCycle: rentDates.billingCycle,
  },
  select: {
    paymentMethod: true,
  },
});
        const netExpected =
  ledger.totalChargesCents - ledger.totalCreditsCents;

totalExpectedCents += Math.max(0, netExpected);
const cyclePaymentsSum = await prisma.payment.aggregate({
  where: {
    propertyId: property.id,
    unitId: unit.id,
    tenantAssignmentId: assignment.id,
    status: "PAID",
    billingCycle: rentDates.billingCycle,
  },
  _sum: {
    amountCents: true,
  },
});

totalCollectedCents += Math.max(0, cyclePaymentsSum._sum.amountCents ?? 0);

        if (delinquency.isDelinquent) {
          delinquentCount++;
        }
         
        if (ledger.balanceCents > 0) {
  unpaidUnitsCount++;
} else {
  totalPaidCount++;

  const hasManual = payments.some(
  (p: { paymentMethod: string | null }) => p.paymentMethod === "MANUAL"
);
const hasPortal = payments.some(
  (p: { paymentMethod: string | null }) => p.paymentMethod === "ACH"
);

  if (hasManual) manualPaidCount++;
  else if (hasPortal) portalPaidCount++;
}
    
        let paymentStatus: PaymentStatus = "UNPAID";

/**
 * STEP 1: Detect most recent payment status (operational state)
 */
const cyclePayments = await prisma.payment.findMany({
  where: {
    unitId: unit.id,
    tenantAssignmentId: assignment.id,
    billingCycle: rentDates.billingCycle,
  },
  select: { status: true },
});

const statuses = cyclePayments as { status: PaymentStatus }[];

const hasPaid = statuses.some((p) => p.status === "PAID");
const hasPending = statuses.some((p) => p.status === "PENDING");
const hasFailed = statuses.some((p) => p.status === "FAILED");
const hasReversed = statuses.some((p) => p.status === "REVERSED");

if (ledger.balanceCents <= 0) {
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
  isDelinquent: Boolean(delinquency.isDelinquent),
  daysPastDue: Number(delinquency.daysPastDue || 0),
  paymentStatus,
  tierName: unit.tier?.name ?? "Units",
 nextCycleAdjustments: nextCycleAdjustments.map(
  (entry: (typeof nextCycleAdjustments)[number]) => ({
    id: entry.id,
    type: entry.entryType,
    chargeType: entry.chargeType,
    amount: entry.amountCents / 100,
    memo: entry.memo,
    effectiveDate: entry.effectiveDate.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    billingCycle: entry.billingCycle,
  })
),
};
      })
    );

    const finalUnits = resolvedUnits.filter(
      (u): u is NonNullable<typeof u> => u !== null
    );

    const totalExpected = Math.round(totalExpectedCents) / 100;
    const totalCollected = Math.round(totalCollectedCents) / 100;

     const billingLabel = (() => {
  const anchorUnit = units[0] ?? null;

  const effective = resolveEffectiveBillingSettings({
    tier: anchorUnit?.tier ?? null,
    propertySettings: property.settings ?? null,
  });

  const rentDates = getRentDateSummary({
    ...effective,
    now: new Date(),
  });



  const [year, month] = rentDates.billingCycle.split("-");

  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  );
})();

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
      units: finalUnits,
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