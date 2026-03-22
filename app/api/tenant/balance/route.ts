import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

type RecurringFeeItemRow = {
  id: string;
  label: string;
  amount: number;
  displayOrder: number;
};

type RecurringCharge = {
  id: string;
  label: string;
  amount: number;
  displayOrder: number;
};

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export async function GET() {
  try {
    const session = await getSession();

    if (
      !session ||
      session.role !== "TENANT" ||
      !session.unitId ||
      !session.propertyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            propertyCode: true,
            settings: {
              select: {
                rentDueDay: true,
                gracePeriodDays: true,
                lateFeeEnabled: true,
                lateFeeFlat: true,
                lateFeePercent: true,
              },
            },
          },
        },
        tier: {
          select: {
            id: true,
            name: true,
            baseRent: true,
            unitCount: true,
            rentDueDay: true,
            gracePeriodDays: true,
            lateFeeInitial: true,
            lateFeeDaily: true,
            lateFeeMaxDays: true,
            processingFee: true,
            isActive: true,
          },
        },
        recurringFeeItems: {
          where: {
            isActive: true,
          },
          orderBy: {
            displayOrder: "asc",
          },
          select: {
            id: true,
            label: true,
            amount: true,
            displayOrder: true,
          },
        },
        tenantAssignments: {
          where: {
            isCurrent: true,
          },
          orderBy: {
            moveInDate: "desc",
          },
          take: 1,
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const [ledger, delinquency] = await Promise.all([
      getUnitLedgerSummary(unit.id),
      getUnitDelinquencySummary(unit.id),
    ]);

    const activeAssignment = unit.tenantAssignments[0] || null;

    const baseRent = roundMoney(
      Number(unit.tier?.baseRent ?? unit.baseRent ?? 0)
    );

    const recurringFeeItems: RecurringFeeItemRow[] = unit.recurringFeeItems.map(
      (fee: RecurringFeeItemRow) => ({
        id: fee.id,
        label: fee.label,
        amount: Number(fee.amount || 0),
        displayOrder: Number(fee.displayOrder || 0),
      })
    );

    const recurringCharges: RecurringCharge[] = recurringFeeItems.map(
      (fee: RecurringFeeItemRow) => ({
        id: fee.id,
        label: fee.label,
        amount: roundMoney(Number(fee.amount || 0)),
        displayOrder: Number(fee.displayOrder || 0),
      })
    );

    const recurringChargeTotal = roundMoney(
      recurringCharges.reduce(
        (sum: number, fee: RecurringCharge) => sum + fee.amount,
        0
      )
    );

    const monthlySubtotal = roundMoney(baseRent + recurringChargeTotal);
    const processingFee = roundMoney(Number(unit.tier?.processingFee || 0));
    const balanceDue = roundMoney(Math.max(0, Number(ledger.balance || 0)));
    const totalIfPaidNow = roundMoney(balanceDue + processingFee);

    return NextResponse.json({
      ok: true,
      property: {
        id: unit.property.id,
        name: unit.property.name,
        propertyCode: unit.property.propertyCode,
      },
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        unitType: unit.unitType,
        baseRent,
        isActive: Boolean(unit.isActive),
        portalActivated: Boolean(unit.portalActivated),
        tier: unit.tier
          ? {
              id: unit.tier.id,
              name: unit.tier.name,
              unitCount: Number(unit.tier.unitCount || 0),
              processingFee,
              isActive: Boolean(unit.tier.isActive),
            }
          : null,
      },
      tenant: activeAssignment
        ? {
            id: activeAssignment.id,
            name: [activeAssignment.firstName, activeAssignment.lastName]
              .filter(Boolean)
              .join(" "),
            email: activeAssignment.email,
            phone: activeAssignment.phone,
          }
        : null,
      charges: {
        baseRent,
        recurringCharges,
        recurringChargeTotal,
        monthlySubtotal,
        processingFee,
      },
      rules: {
        dueDay: Number(
          unit.tier?.rentDueDay ?? unit.property.settings?.rentDueDay ?? 1
        ),
        gracePeriodDays: Number(
          unit.tier?.gracePeriodDays ??
            unit.property.settings?.gracePeriodDays ??
            0
        ),
        lateFees: unit.tier
          ? {
              enabled: true,
              initialFee: roundMoney(Number(unit.tier.lateFeeInitial || 0)),
              dailyFee: roundMoney(Number(unit.tier.lateFeeDaily || 0)),
              maxDays: Number(unit.tier.lateFeeMaxDays || 0),
            }
          : {
              enabled: Boolean(unit.property.settings?.lateFeeEnabled),
              initialFee: roundMoney(
                Number(unit.property.settings?.lateFeeFlat || 0)
              ),
              dailyFee: 0,
              maxDays: 0,
            },
      },
      balance: {
        currentBalance: balanceDue,
        totalCharges: roundMoney(Number(ledger.totalCharges || 0)),
        totalPaid: roundMoney(Number(ledger.totalPaid || 0)),
        lastPaymentDate: ledger.lastPaymentDate,
        lastPaymentAmount: roundMoney(Number(ledger.lastPaymentAmount || 0)),
        totalIfPaidNow,
      },
      delinquency: {
        isDelinquent: Boolean(delinquency.isDelinquent),
        daysPastDue: Number(delinquency.daysPastDue || 0),
        lateFeesOwed: roundMoney(Number(delinquency.lateFeesOwed || 0)),
        unpaidRent: roundMoney(Number(delinquency.unpaidRent || 0)),
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/tenant/balance failed", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}