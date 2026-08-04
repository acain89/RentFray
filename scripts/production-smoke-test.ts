import { prisma } from "../lib/prisma";

const QA_PROPERTY_CODE = "9998";
const QA_PROPERTY_NAME = "RENTFRAY PRODUCTION SMOKE TEST";

const RENT_FRAY_START_DATE = new Date("2026-09-01T00:00:00.000Z");
const TENANT_MOVE_IN_DATE = new Date("2026-08-15T00:00:00.000Z");

type SmokeFixture = {
  propertyId: string;
  tierId: string;
  unitId: string;
  tenantAssignmentId: string;
  recurringFeeId: string;
};

let passed = 0;

function heading(): void {
  console.log("");
  console.log("========================================");
  console.log(" RENTFRAY PRODUCTION SMOKE TEST");
  console.log("========================================");
  console.log("");
}

function pass(name: string, detail?: string): void {
  passed += 1;

  console.log(
    `PASS  ${name}${detail ? ` - ${detail}` : ""}`
  );
}

function assertEqual<T>(
  name: string,
  actual: T,
  expected: T
): void {
  if (actual !== expected) {
    throw new Error(
      [
        name,
        `Expected: ${String(expected)}`,
        `Actual: ${String(actual)}`,
      ].join("\n")
    );
  }

  pass(name, String(actual));
}

function assertTrue(
  name: string,
  condition: boolean,
  detail?: string
): void {
  if (!condition) {
    throw new Error(
      `${name}${detail ? `\n${detail}` : ""}`
    );
  }

  pass(name, detail);
}

async function cleanupSmokeProperty(): Promise<number> {
  const result = await prisma.property.deleteMany({
    where: {
      propertyCode: QA_PROPERTY_CODE,
    },
  });

  return result.count;
}

async function createFixture(): Promise<SmokeFixture> {
  const property = await prisma.property.create({
    data: {
      name: QA_PROPERTY_NAME,
      propertyCode: QA_PROPERTY_CODE,
      status: "ACTIVE",
      propertyType: "OTHER",
      addressLine1: "9998 Smoke Test Lane",
      city: "Test City",
      state: "TX",
      zip: "99999",
      ownerDisplayName: "Smoke Test Owner",
      contactEmail: "smoke-test@rentfray.local",
      isActive: true,
      unitCount: 1,
      rentFrayStartDate: RENT_FRAY_START_DATE,

      settings: {
        create: {
          rentDueDay: 1,
          gracePeriodDays: 5,
          lateFeeEnabled: true,
          lateFeeFlatCents: 5000,
          convenienceFeeEnabled: false,
          allowTestMode: true,
          tenantPortalEnabled: true,
          maintenancePortalEnabled: true,
          onboardingComplete: true,
          setupComplete: true,
        },
      },
    },
    select: {
      id: true,
      propertyCode: true,
      rentFrayStartDate: true,
    },
  });

  assertEqual(
    "Property created",
    property.propertyCode,
    QA_PROPERTY_CODE
  );

  assertEqual(
    "RentFray Start Date created",
    property.rentFrayStartDate?.toISOString().slice(0, 10),
    "2026-09-01"
  );

  const tier = await prisma.propertyTier.create({
    data: {
      propertyId: property.id,
      name: "Smoke Test Tier",
      baseRentCents: 100_000,
      unitCount: 1,
      activeUnitCount: 1,
      billingFrequency: "MONTHLY",
      rentDueDay: 1,
      gracePeriodDays: 5,
      lateFeeType: "FLAT",
      lateFeeInitialCents: 5_000,
      lateFeeDailyCents: 1_000,
      maxLateFeeDays: 5,
      processingFeeCents: 0,
      sortOrder: 1,
      isActive: true,
    },
    select: {
      id: true,
      baseRentCents: true,
      rentDueDay: true,
    },
  });

  assertEqual(
    "Tier created with $1,000 rent",
    tier.baseRentCents,
    100_000
  );

  assertEqual(
    "Tier due day is the 1st",
    tier.rentDueDay,
    1
  );

  const unit = await prisma.unit.create({
    data: {
      propertyId: property.id,
      tierId: tier.id,
      unitNumber: "101",
      isActive: true,
      portalActivated: true,
      portalFirstName: "Smoke",
      portalLastName: "Tenant",
      activatedAt: TENANT_MOVE_IN_DATE,
      activationSource: "PRODUCTION_SMOKE_TEST",
    },
    select: {
      id: true,
      unitNumber: true,
      tierId: true,
    },
  });

  assertEqual(
    "Unit created",
    unit.unitNumber,
    "101"
  );

  assertEqual(
    "Unit assigned to tier",
    unit.tierId,
    tier.id
  );

  const tenantAssignment =
    await prisma.tenantAssignment.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        firstName: "Smoke",
        lastName: "Tenant",
        email: "smoke-tenant@rentfray.local",
        moveInDate: TENANT_MOVE_IN_DATE,
        isCurrent: true,
      },
      select: {
        id: true,
        isCurrent: true,
        moveInDate: true,
      },
    });

  assertTrue(
    "Tenant assignment created",
    tenantAssignment.isCurrent === true
  );

  assertEqual(
    "Tenant move-in date created",
    tenantAssignment.moveInDate
      ?.toISOString()
      .slice(0, 10),
    "2026-08-15"
  );

  const recurringFee =
    await prisma.unitRecurringFee.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        label: "Water",
        amountCents: 2_500,
        isActive: true,
        displayOrder: 1,
      },
      select: {
        id: true,
        label: true,
        amountCents: true,
      },
    });

  assertEqual(
    "Recurring fee created",
    recurringFee.label,
    "Water"
  );

  assertEqual(
    "Recurring fee amount is $25",
    recurringFee.amountCents,
    2_500
  );

  return {
    propertyId: property.id,
    tierId: tier.id,
    unitId: unit.id,
    tenantAssignmentId: tenantAssignment.id,
    recurringFeeId: recurringFee.id,
  };
}

async function verifyFixture(
  fixture: SmokeFixture
): Promise<void> {
  const property = await prisma.property.findUnique({
    where: {
      id: fixture.propertyId,
    },
    include: {
      settings: true,
      tiers: true,
      units: {
        include: {
          tenantAssignments: true,
          recurringFeeItems: true,
        },
      },
    },
  });

async function verifyPreStartState(
  fixture: SmokeFixture
): Promise<void> {
  const { getUnitLedgerSummary } = await import("../lib/ledger");

  const summary = await getUnitLedgerSummary({
    unitId: fixture.unitId,
    tenantAssignmentId: fixture.tenantAssignmentId,
    asOf: new Date("2026-08-31T12:00:00Z"),
  });

  assertEqual(
    "Pre-start balance",
    summary.balanceCents,
    0
  );

  assertEqual(
    "Pre-start charges",
    summary.totalChargesCents,
    0
  );

  assertEqual(
    "Pre-start payments",
    summary.totalPaidCents,
    0
  );
}

async function verifyFirstBillingCycle(
  fixture: SmokeFixture
): Promise<void> {

  const { runMonthlyRentJob } = await import("../jobs/monthlyRent");

  const result = await runMonthlyRentJob(
    new Date("2026-09-01T12:00:00Z"),
    fixture.propertyId
  );

  assertEqual(
    "Monthly rent job created one rent charge",
    result.rentChargesCreated,
    1
  );

  assertEqual(
    "Monthly rent job created one recurring fee",
    result.recurringFeeChargesCreated,
    1
  );

  const rentCharges =
    await prisma.ledgerEntry.count({
      where: {
        propertyId: fixture.propertyId,
        chargeType: "RENT",
        billingCycle: "2026-09",
        voidedAt: null,
      },
    });

  assertEqual(
    "Exactly one September rent charge",
    rentCharges,
    1
  );

  const recurringCharges =
    await prisma.ledgerEntry.count({
      where: {
        propertyId: fixture.propertyId,
        chargeType: "RECURRING_FEE",
        billingCycle: "2026-09",
        voidedAt: null,
      },
    });

  assertEqual(
    "Exactly one September recurring fee",
    recurringCharges,
    1
  );
}

  assertTrue(
    "Fixture property can be reloaded",
    property !== null
  );

  if (!property) {
    throw new Error("Fixture property disappeared.");
  }

  assertEqual(
    "Fixture has one tier",
    property.tiers.length,
    1
  );

  assertEqual(
    "Fixture has one unit",
    property.units.length,
    1
  );

assertEqual(
  "Fixture has one current tenant",
  property.units[0]?.tenantAssignments.filter(
    (
      assignment: (typeof property.units)[number]["tenantAssignments"][number]
    ) => assignment.isCurrent
  ).length ?? 0,
  1
);

  assertEqual(
    "Fixture has one recurring fee",
    property.units[0]?.recurringFeeItems.length ?? 0,
    1
  );

  assertEqual(
    "Property grace period is five days",
    property.settings?.gracePeriodDays,
    5
  );
}

async function verifyPreStartState(
  fixture: SmokeFixture
): Promise<void> {
  const { getUnitLedgerSummary } = await import("../lib/ledger");

  const summary = await getUnitLedgerSummary({
    unitId: fixture.unitId,
    tenantAssignmentId: fixture.tenantAssignmentId,
    asOf: new Date("2026-08-31T12:00:00Z"),
  });

  assertEqual(
    "Pre-start balance",
    summary.balanceCents,
    0
  );

  assertEqual(
    "Pre-start charges",
    summary.totalChargesCents,
    0
  );

  assertEqual(
    "Pre-start payments",
    summary.totalPaidCents,
    0
  );
}

async function verifyFirstBillingCycle(
  fixture: SmokeFixture
): Promise<void> {
  const { runMonthlyRentJob } = await import("../jobs/monthlyRent");

  const result = await runMonthlyRentJob(
    new Date("2026-09-01T12:00:00Z"),
    fixture.propertyId
  );

  assertEqual(
    "Monthly rent job created one rent charge",
    result.rentChargesCreated,
    1
  );

  assertEqual(
    "Monthly rent job created one recurring fee",
    result.recurringFeeChargesCreated,
    1
  );

  const rentCharges = await prisma.ledgerEntry.count({
    where: {
      propertyId: fixture.propertyId,
      chargeType: "RENT",
      billingCycle: "2026-09",
      voidedAt: null,
    },
  });

  assertEqual(
    "Exactly one September rent charge",
    rentCharges,
    1
  );

  const recurringCharges = await prisma.ledgerEntry.count({
    where: {
      propertyId: fixture.propertyId,
      chargeType: "RECURRING_FEE",
      billingCycle: "2026-09",
      voidedAt: null,
    },
  });

  assertEqual(
    "Exactly one September recurring fee",
    recurringCharges,
    1
  );
}

async function verifyBillingReplayAndBalance(
  fixture: SmokeFixture
): Promise<void> {
  const { runMonthlyRentJob } = await import("../jobs/monthlyRent");
  const { getUnitLedgerSummary } = await import("../lib/ledger");

  const replayResult = await runMonthlyRentJob(
    new Date("2026-09-01T12:00:00Z"),
    fixture.propertyId
  );

  assertEqual(
    "Monthly rent replay created zero rent charges",
    replayResult.rentChargesCreated,
    0
  );

  assertEqual(
    "Monthly rent replay created zero recurring fees",
    replayResult.recurringFeeChargesCreated,
    0
  );

  const rentCharges = await prisma.ledgerEntry.count({
    where: {
      propertyId: fixture.propertyId,
      unitId: fixture.unitId,
      billingCycle: "2026-09",
      chargeType: "RENT",
      voidedAt: null,
    },
  });

  assertEqual(
    "Replay leaves exactly one rent charge",
    rentCharges,
    1
  );

  const recurringCharges = await prisma.ledgerEntry.count({
    where: {
      propertyId: fixture.propertyId,
      unitId: fixture.unitId,
      billingCycle: "2026-09",
      chargeType: "RECURRING_FEE",
      voidedAt: null,
    },
  });

  assertEqual(
    "Replay leaves exactly one recurring fee",
    recurringCharges,
    1
  );

  const summary = await getUnitLedgerSummary({
    unitId: fixture.unitId,
    tenantAssignmentId: fixture.tenantAssignmentId,
    asOf: new Date("2026-09-01T12:00:00Z"),
    billingCycle: "2026-09",
  });

  assertEqual(
    "September balance is $1,025",
    summary.balanceCents,
    102_500
  );

  assertEqual(
    "September rent total is $1,000",
    summary.currentCycleRentChargesCents,
    100_000
  );

  assertEqual(
    "September recurring total is $25",
    summary.currentCycleRecurringChargesCents,
    2_500
  );

  assertEqual(
    "September late-fee total is initially $0",
    summary.currentCycleLateFeeChargesCents,
    0
  );
}

async function verifyLateFeeLifecycle(
  fixture: SmokeFixture
): Promise<void> {
  const { runLateFeesJob } = await import("../jobs/lateFees");
  const { getUnitLedgerSummary } = await import("../lib/ledger");

  const duringGrace = await runLateFeesJob(
    new Date("2026-09-04T12:00:00Z"),
    fixture.propertyId
  );

  assertEqual(
    "Grace-period late-fee job posted zero charges",
    duringGrace.posted,
    0
  );

  const initialLateFeeRun = await runLateFeesJob(
    new Date("2026-09-06T12:00:00Z"),
    fixture.propertyId
  );

  assertEqual(
    "Initial late-fee run posted one charge",
    initialLateFeeRun.posted,
    1
  );

  const initialLateFeeCount =
    await prisma.ledgerEntry.count({
      where: {
        propertyId: fixture.propertyId,
        unitId: fixture.unitId,
        billingCycle: "2026-09",
        chargeType: "LATE_FEE_INITIAL",
        voidedAt: null,
      },
    });

  assertEqual(
    "Exactly one initial late fee exists",
    initialLateFeeCount,
    1
  );

  const initialLateFee = await prisma.ledgerEntry.findFirst({
    where: {
      propertyId: fixture.propertyId,
      unitId: fixture.unitId,
      billingCycle: "2026-09",
      chargeType: "LATE_FEE_INITIAL",
      voidedAt: null,
    },
    select: {
      amountCents: true,
    },
  });

  assertEqual(
    "Initial late fee is $50",
    initialLateFee?.amountCents ?? null,
    5_000
  );

  const finalDailyRun = await runLateFeesJob(
    new Date("2026-09-11T12:00:00Z"),
    fixture.propertyId
  );

  assertEqual(
    "Daily late-fee catch-up posted five charges",
    finalDailyRun.posted,
    5
  );

  const dailyLateFeeCount =
    await prisma.ledgerEntry.count({
      where: {
        propertyId: fixture.propertyId,
        unitId: fixture.unitId,
        billingCycle: "2026-09",
        chargeType: "LATE_FEE_DAILY",
        voidedAt: null,
      },
    });

  assertEqual(
    "Exactly five daily late fees exist",
    dailyLateFeeCount,
    5
  );

  const dailyLateFeeAggregate =
    await prisma.ledgerEntry.aggregate({
      where: {
        propertyId: fixture.propertyId,
        unitId: fixture.unitId,
        billingCycle: "2026-09",
        chargeType: "LATE_FEE_DAILY",
        voidedAt: null,
      },
      _sum: {
        amountCents: true,
      },
    });

  assertEqual(
    "Daily late fees total $50",
    dailyLateFeeAggregate._sum.amountCents ?? 0,
    5_000
  );

  const replayRun = await runLateFeesJob(
    new Date("2026-09-11T12:00:00Z"),
    fixture.propertyId
  );

  assertEqual(
    "Late-fee replay posted zero charges",
    replayRun.posted,
    0
  );

  const summary = await getUnitLedgerSummary({
    unitId: fixture.unitId,
    tenantAssignmentId: fixture.tenantAssignmentId,
    asOf: new Date("2026-09-11T12:00:00Z"),
    billingCycle: "2026-09",
  });

  assertEqual(
    "Current-cycle late fees total $100",
    summary.currentCycleLateFeeChargesCents,
    10_000
  );

  assertEqual(
    "Balance after all late fees is $1,125",
    summary.balanceCents,
    112_500
  );
}

async function verifySuccessfulPaymentLifecycle(
  fixture: SmokeFixture
): Promise<void> {
  const { getUnitLedgerSummary } = await import("../lib/ledger");
  const { getUnitFinancialState } = await import(
    "../lib/unitFinancialState"
  );
  const { getUnitDelinquencySummary } = await import(
    "../lib/delinquency"
  );
  const { runLateFeesJob } = await import("../jobs/lateFees");

  const property = await prisma.property.findUnique({
    where: {
      id: fixture.propertyId,
    },
    include: {
      settings: true,
    },
  });

  if (!property) {
    throw new Error("Smoke-test property could not be loaded.");
  }

  const tier = await prisma.propertyTier.findUnique({
    where: {
      id: fixture.tierId,
    },
  });

  if (!tier) {
    throw new Error("Smoke-test tier could not be loaded.");
  }

  const paymentAmountCents = 112_500;
  const paidAt = new Date("2026-09-11T15:00:00Z");

  const payment = await prisma.payment.create({
    data: {
      propertyId: fixture.propertyId,
      unitId: fixture.unitId,
      tenantAssignmentId: fixture.tenantAssignmentId,
      billingCycle: "2026-09",
      amountCents: paymentAmountCents,
      processingFeeCents: 0,
      status: "PAID",
      paymentMethod: "SMOKE_TEST",
      paidAt,
    },
    select: {
      id: true,
      status: true,
      amountCents: true,
    },
  });

  assertEqual(
    "Paid payment record created",
    payment.status,
    "PAID"
  );

  assertEqual(
    "Paid payment amount is $1,125",
    payment.amountCents,
    paymentAmountCents
  );

  const paymentLedgerEntry =
    await prisma.ledgerEntry.create({
      data: {
        propertyId: fixture.propertyId,
        unitId: fixture.unitId,
        tenantAssignmentId: fixture.tenantAssignmentId,
        paymentId: payment.id,
        billingCycle: "2026-09",
        entryType: "PAYMENT",
        paymentMethod: "SMOKE_TEST",
        amountCents: paymentAmountCents,
        effectiveDate: paidAt,
        memo: "Production smoke-test payment",
      },
      select: {
        id: true,
        paymentId: true,
        amountCents: true,
      },
    });

  assertEqual(
    "Payment ledger entry linked to payment",
    paymentLedgerEntry.paymentId,
    payment.id
  );

  assertEqual(
    "Payment ledger entry amount is $1,125",
    paymentLedgerEntry.amountCents,
    paymentAmountCents
  );

  const paymentLedgerEntryCount =
    await prisma.ledgerEntry.count({
      where: {
        propertyId: fixture.propertyId,
        unitId: fixture.unitId,
        paymentId: payment.id,
        entryType: "PAYMENT",
        voidedAt: null,
      },
    });

  assertEqual(
    "Exactly one payment ledger entry exists",
    paymentLedgerEntryCount,
    1
  );

  const ledgerSummary = await getUnitLedgerSummary({
    unitId: fixture.unitId,
    tenantAssignmentId: fixture.tenantAssignmentId,
    asOf: new Date("2026-09-12T12:00:00Z"),
    billingCycle: "2026-09",
  });

  assertEqual(
    "Ledger total charges are $1,125",
    ledgerSummary.totalChargesCents,
    112_500
  );

  assertEqual(
    "Ledger total paid is $1,125",
    ledgerSummary.totalPaidCents,
    112_500
  );

  assertEqual(
    "Ledger credits remain zero",
    ledgerSummary.totalCreditsCents,
    0
  );

  assertEqual(
    "Ledger balance is zero after payment",
    ledgerSummary.balanceCents,
    0
  );

  assertEqual(
    "Ledger recognizes current-cycle paid payment",
    ledgerSummary.hasPaidPayment,
    true
  );

  assertEqual(
    "Ledger has no pending payment",
    ledgerSummary.hasPendingPayment,
    false
  );

  const financialState = await getUnitFinancialState({
    propertyId: fixture.propertyId,
    unitId: fixture.unitId,
    tenantAssignmentId: fixture.tenantAssignmentId,
    tier,
    propertySettings: property.settings,
    rentFrayStartDate: property.rentFrayStartDate,
    now: new Date("2026-09-12T12:00:00Z"),
  });

  assertEqual(
    "Financial-state ledger balance is zero",
    financialState.ledgerBalanceCents,
    0
  );

  assertEqual(
    "Tenant total due is zero",
    financialState.tenantTotalDueCents,
    0
  );

  assertEqual(
    "Processing fee is zero",
    financialState.processingFeeCents,
    0
  );

  assertEqual(
    "Financial state is not delinquent",
    financialState.isDelinquent,
    false
  );

  assertEqual(
    "Financial state is not past grace",
    financialState.isPastGracePeriod,
    false
  );

  assertEqual(
    "Financial state is not within grace",
    financialState.isWithinGracePeriod,
    false
  );

  assertEqual(
    "Financial state recognizes paid payment",
    financialState.hasPaidPayment,
    true
  );

  assertEqual(
    "Financial-state payment status is PAID",
    financialState.paymentStatus,
    "PAID"
  );

  const delinquencySummary =
    await getUnitDelinquencySummary(
      fixture.unitId,
      new Date("2026-09-12T12:00:00Z")
    );

  assertEqual(
    "Delinquency total balance is zero",
    delinquencySummary.totalBalanceCents,
    0
  );

  assertEqual(
    "Delinquency amount due is zero",
    delinquencySummary.amountDueNowCents,
    0
  );

  assertEqual(
    "Delinquency days past due is zero",
    delinquencySummary.daysPastDue,
    0
  );

  assertEqual(
    "Delinquency state is false",
    delinquencySummary.isDelinquent,
    false
  );

  assertEqual(
    "Late fees owed after payment are zero",
    delinquencySummary.lateFeesOwedCents,
    0
  );

  assertEqual(
    "Ledger and financial state agree",
    financialState.ledgerBalanceCents,
    ledgerSummary.balanceCents
  );

  assertEqual(
    "Ledger and delinquency summary agree",
    delinquencySummary.totalBalanceCents,
    ledgerSummary.balanceCents
  );

  const lateFeeReplayAfterPayment =
    await runLateFeesJob(
      new Date("2026-09-12T12:00:00Z"),
      fixture.propertyId
    );

  assertEqual(
    "Late-fee job after payment posts zero charges",
    lateFeeReplayAfterPayment.posted,
    0
  );

  const finalLateFeeCount =
    await prisma.ledgerEntry.count({
      where: {
        propertyId: fixture.propertyId,
        unitId: fixture.unitId,
        billingCycle: "2026-09",
        chargeType: {
          in: [
            "LATE_FEE",
            "LATE_FEE_INITIAL",
            "LATE_FEE_DAILY",
          ],
        },
        voidedAt: null,
      },
    });

  assertEqual(
    "Late-fee count remains capped at six",
    finalLateFeeCount,
    6
  );
}

async function main(): Promise<void> {
  heading();

  const removedBefore = await cleanupSmokeProperty();

  pass(
    "Initial cleanup completed",
    `${removedBefore} previous fixture(s) removed`
  );

  try {
    const fixture = await createFixture();

    await verifyFixture(fixture);
    await verifyPreStartState(fixture);

await verifyFirstBillingCycle(fixture);
await verifyBillingReplayAndBalance(fixture);
await verifyLateFeeLifecycle(fixture);
await verifySuccessfulPaymentLifecycle(fixture);

    console.log("");
    console.log(
      `Fixture property ID: ${fixture.propertyId}`
    );

    console.log(
      `Fixture unit ID: ${fixture.unitId}`
    );
  } finally {
    const removedAfter = await cleanupSmokeProperty();

    assertEqual(
      "Final cleanup removed fixture",
      removedAfter,
      1
    );
  }

  const remaining = await prisma.property.count({
    where: {
      propertyCode: QA_PROPERTY_CODE,
    },
  });

  assertEqual(
    "No smoke-test property remains",
    remaining,
    0
  );

  console.log("");
  console.log("========================================");
  console.log(`OVERALL RESULT: PASS (${passed} checks)`);
  console.log("========================================");
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error("========================================");
    console.error("OVERALL RESULT: FAIL");
    console.error("========================================");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupSmokeProperty();
    } finally {
      await prisma.$disconnect();
    }
  });


