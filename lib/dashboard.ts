// lib/dashboard.ts

export type DashboardUnitStatus =
  | "PAID"
  | "GRACE"
  | "PARTIAL"
  | "DELINQUENT"
  | "VACANT";

export type DashboardCounts = {
  paid: number;
  grace: number;
  partial: number;
  delinquent: number;
  vacant: number;
};

export type DashboardSummary = {
  paidSinceClose: number;
  newPayments: number;
  delinquentUnits: number;
  openMaintenance: number;
  vacantUnits: number;
};

export type ExpectedCollected = {
  expectedRentThisCycle: number;
  collectedThisCycle: number;
  remainingThisCycle: number;
};

export type NeedsAttentionItem = {
  type: "DELINQUENT" | "PARTIAL" | "MAINTENANCE";
  unitId?: string | null;
  unitNumber?: string | null;
  requestId?: string | null;
  title: string;
  subtitle?: string | null;
  amount?: number | null;
  createdAt?: Date | string | null;
};

export type RecentActivityItem = {
  type:
    | "PAYMENT"
    | "LATE_FEE"
    | "MAINTENANCE_CREATED"
    | "MAINTENANCE_UPDATED"
    | "STATUS_CHANGE"
    | "MOVE_OUT"
    | "VACANCY";
  title: string;
  subtitle?: string | null;
  amount?: number | null;
  createdAt: Date | string;
  unitId?: string | null;
  unitNumber?: string | null;
};

export type DashboardUnitInput = {
  id: string;
  unitNumber: string;
  marketRent?: number | null;
  hasActiveTenant: boolean;
  currentCycleCharges: number;
  currentCyclePayments: number;
  currentBalance: number;
  openMaintenanceCount?: number | null;
};

export type LedgerActivityInput = {
  id: string;
  type: string;
  amount: number;
  memo?: string | null;
  createdAt: Date | string;
  unitId?: string | null;
  unitNumber?: string | null;
};

export type MaintenanceActivityInput = {
  id: string;
  status: string;
  category: string;
  urgency: string;
  description?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  unitId?: string | null;
  unitNumber?: string | null;
};

function asNumber(value: unknown) {
  return Number(value || 0);
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function getDashboardCutoffDate(now = new Date()) {
  const cutoff = new Date(now);
  const day = cutoff.getDay(); // 0 Sun, 1 Mon

  cutoff.setHours(17, 0, 0, 0);

  if (day === 1) {
    cutoff.setDate(cutoff.getDate() - 3);
  } else if (day === 0) {
    cutoff.setDate(cutoff.getDate() - 2);
  } else {
    cutoff.setDate(cutoff.getDate() - 1);
  }

  return cutoff;
}

export function getCycleDates(
  billingDay: number,
  now = new Date()
): { cycleStart: Date; cycleEnd: Date; dueDate: Date } {
  const safeBillingDay = Math.min(Math.max(Number(billingDay || 1), 1), 28);

  const year = now.getFullYear();
  const month = now.getMonth();

  let cycleStart = new Date(year, month, safeBillingDay, 0, 0, 0, 0);

  if (now.getDate() < safeBillingDay) {
    cycleStart = new Date(year, month - 1, safeBillingDay, 0, 0, 0, 0);
  }

  const cycleEnd = new Date(
    cycleStart.getFullYear(),
    cycleStart.getMonth() + 1,
    safeBillingDay,
    0,
    0,
    0,
    0
  );

  const dueDate = new Date(cycleStart);

  return { cycleStart, cycleEnd, dueDate };
}

export function getUnitStatus(input: {
  hasActiveTenant: boolean;
  currentBalance: number;
  currentCyclePayments: number;
  dueDate: Date;
  gracePeriodDays: number;
  now?: Date;
}): DashboardUnitStatus {
  const {
    hasActiveTenant,
    currentBalance,
    currentCyclePayments,
    dueDate,
    gracePeriodDays,
  } = input;

  const now = input.now ?? new Date();

  if (!hasActiveTenant) return "VACANT";
  if (currentBalance <= 0) return "PAID";

  const delinquentDate = new Date(dueDate);
  delinquentDate.setDate(delinquentDate.getDate() + Number(gracePeriodDays || 0));

  if (now > delinquentDate) return "DELINQUENT";
  if (currentCyclePayments > 0) return "PARTIAL";
  return "GRACE";
}

export function sortStatusProblemFirst(a: DashboardUnitStatus, b: DashboardUnitStatus) {
  const order: Record<DashboardUnitStatus, number> = {
    DELINQUENT: 1,
    PARTIAL: 2,
    GRACE: 3,
    PAID: 4,
    VACANT: 5,
  };

  return order[a] - order[b];
}

export function countStatuses(statuses: DashboardUnitStatus[]): DashboardCounts {
  const counts: DashboardCounts = {
    paid: 0,
    grace: 0,
    partial: 0,
    delinquent: 0,
    vacant: 0,
  };

  for (const status of statuses) {
    if (status === "PAID") counts.paid++;
    if (status === "GRACE") counts.grace++;
    if (status === "PARTIAL") counts.partial++;
    if (status === "DELINQUENT") counts.delinquent++;
    if (status === "VACANT") counts.vacant++;
  }

  return counts;
}

export function buildExpectedVsCollected(
  units: DashboardUnitInput[]
): ExpectedCollected {
  let expectedRentThisCycle = 0;
  let collectedThisCycle = 0;

  for (const unit of units) {
    if (unit.hasActiveTenant) {
      expectedRentThisCycle += asNumber(unit.marketRent);
    }

    collectedThisCycle += asNumber(unit.currentCyclePayments);
  }

  const remainingThisCycle = Math.max(
    expectedRentThisCycle - collectedThisCycle,
    0
  );

  return {
    expectedRentThisCycle,
    collectedThisCycle,
    remainingThisCycle,
  };
}

export function buildDashboardSummary(args: {
  units: Array<DashboardUnitInput & { status: DashboardUnitStatus }>;
  ledgerEntriesSinceCutoff: LedgerActivityInput[];
  openMaintenanceCount: number;
}): DashboardSummary {
  let paidSinceClose = 0;
  let newPayments = 0;

  for (const entry of args.ledgerEntriesSinceCutoff) {
    const amount = asNumber(entry.amount);

    if (amount < 0) {
      paidSinceClose += Math.abs(amount);
      newPayments++;
    }
  }

  return {
    paidSinceClose,
    newPayments,
    delinquentUnits: args.units.filter((u) => u.status === "DELINQUENT").length,
    openMaintenance: args.openMaintenanceCount,
    vacantUnits: args.units.filter((u) => u.status === "VACANT").length,
  };
}

export function buildNeedsAttention(
  units: Array<DashboardUnitInput & { status: DashboardUnitStatus }>,
  maintenance: MaintenanceActivityInput[]
): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = [];

  for (const unit of units) {
    if (unit.status === "DELINQUENT") {
      items.push({
        type: "DELINQUENT",
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        title: `Unit ${unit.unitNumber} delinquent`,
        subtitle: "Past due",
        amount: asNumber(unit.currentBalance),
      });
    }

    if (unit.status === "PARTIAL") {
      items.push({
        type: "PARTIAL",
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        title: `Unit ${unit.unitNumber} partial`,
        subtitle: "Partial payment made",
        amount: asNumber(unit.currentBalance),
      });
    }
  }

  for (const request of maintenance) {
    if (request.status !== "COMPLETED" && request.status !== "CLOSED") {
      items.push({
        type: "MAINTENANCE",
        requestId: request.id,
        unitId: request.unitId,
        unitNumber: request.unitNumber,
        title: `Maintenance: ${request.category}`,
        subtitle: request.unitNumber
          ? `Unit ${request.unitNumber} • ${request.urgency}`
          : request.urgency,
        createdAt: request.createdAt,
      });
    }
  }

  return items;
}

export function buildRecentActivity(args: {
  ledgerEntriesSinceCutoff: LedgerActivityInput[];
  maintenanceSinceCutoff: MaintenanceActivityInput[];
}): RecentActivityItem[] {
  const items: RecentActivityItem[] = [];

  for (const entry of args.ledgerEntriesSinceCutoff) {
    const amount = asNumber(entry.amount);

    if (amount < 0) {
      items.push({
        type: "PAYMENT",
        title: "Payment received",
        subtitle: entry.unitNumber ? `Unit ${entry.unitNumber}` : entry.memo || null,
        amount: Math.abs(amount),
        createdAt: entry.createdAt,
        unitId: entry.unitId,
        unitNumber: entry.unitNumber,
      });
    } else if (String(entry.type).toUpperCase().includes("LATE_FEE")) {
      items.push({
        type: "LATE_FEE",
        title: "Late fee applied",
        subtitle: entry.unitNumber ? `Unit ${entry.unitNumber}` : entry.memo || null,
        amount,
        createdAt: entry.createdAt,
        unitId: entry.unitId,
        unitNumber: entry.unitNumber,
      });
    }
  }

  for (const request of args.maintenanceSinceCutoff) {
    items.push({
      type:
        toDate(request.updatedAt || request.createdAt).getTime() !==
        toDate(request.createdAt).getTime()
          ? "MAINTENANCE_UPDATED"
          : "MAINTENANCE_CREATED",
      title: `Maintenance ${request.status.toLowerCase()}`,
      subtitle: request.unitNumber
        ? `Unit ${request.unitNumber} • ${request.category}`
        : request.category,
      createdAt: request.updatedAt || request.createdAt,
      unitId: request.unitId,
      unitNumber: request.unitNumber,
    });
  }

  return items.sort(
    (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
  );
}

export function percentCollected(data: ExpectedCollected) {
  if (data.expectedRentThisCycle <= 0) return 0;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round((data.collectedThisCycle / data.expectedRentThisCycle) * 100)
    )
  );
}