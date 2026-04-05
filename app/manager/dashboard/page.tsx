"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Unit = {
  unitId: string;
  unitNumber: string;
  tenantName: string | null;
  balance: number;
  isDelinquent: boolean;
  daysPastDue: number;
  tierName?: string | null;
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";
  isActive: boolean;
};

type DashboardPayment = {
  id: string;
  unitNumber: string;
  tierId: string;
  tierName: string;
  amount: number;
  createdAt: string;
  lastName?: string;
};

type DashboardTier = {
  id: string;
  name: string;
  unitCount: number;
  baseRent?: number;
};

type DashboardData = {
  property: {
  id: string;
  name: string;
  code: string;
  paymentStatus?: {
    bankConnected?: boolean;
  };
};
  session: {
    role: "OWNER" | "MANAGER" | "STAFF";
  };
  summary?: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    delinquentUnits: number;
  };
    financials?: {
    expected: number;
    collected: number;
    collectionRate: number;
    paidTotal?: number;
    pendingTotal?: number;
    processingTotal?: number;
    failedTotal?: number;
    refundedTotal?: number;
  };
  cycleSnapshot?: {
    billingCycleLabel: string;
    occupiedUnitsLabel: string;
    portalPaidCount: number;
    manualPaidCount: number;
    totalPaidCount: number;
    unpaidUnitsCount: number;
    totalCollected: number;
    totalExpected: number;
    collectionRate: number;
    difference: number;
  };
  units: Unit[];
  payments: DashboardPayment[];
  tiers: DashboardTier[];
};

type UnitStatus = "PAID" | "GRACE" | "PENDING" | "FAILED" | "DELINQUENT";

type PanelKey = "charges" | "rent" | "gplf" | "manager" | "info" | "maint" | "bank" | null;

type UnitWithStatus = Unit & {
  status: UnitStatus;
  displayLastName: string;
};

type TierGroup = {
  tierName: string;
  units: UnitWithStatus[];
};

type RentTierDraft = {
  id: string;
  tierName: string;
  baseRent: string;
  dueDay: string;
  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: string;
};

type AdditionalChargeDraft = {
  id: string;
  label: string;
  amount: string;
};

type TierChargesDraft = {
  tierId: string;
  tierName: string;
  charges: AdditionalChargeDraft[];
};

type PropertyChargesResponse = {
  ok?: boolean;
  error?: string;
  effectiveMonth?: string;
  effectiveDate?: string;
  nextEffectiveMonth?: string;
  tiers?: {
    tierId: string;
    tierName: string;
    charges?: {
      id?: string;
      label?: string;
      amount?: number;
      effectiveDate?: string;
      sortOrder?: number;
    }[];
  }[];
};

type MaintenanceRequestRow = {
  id: string;
  unitNumber: string;
  tenantName: string | null;
  category: string;
  urgency: string;
  status: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type MaintenanceListResponse = {
  ok?: boolean;
  error?: string;
  requests?: MaintenanceRequestRow[];
};

type MaintenanceUpdateResponse = {
  ok?: boolean;
  error?: string;
  deletedId?: string;
};

type MaintenanceAction = "COMPLETE" | "IN_PROGRESS" | "DELETE";

type ManagerRole = "MANAGER" | "STAFF";

type ManagerUser = {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
};

type ManagersListResponse = {
  ok?: boolean;
  error?: string;
  users?: ManagerUser[];
};

type ManagerMutationResponse = {
  ok?: boolean;
  error?: string;
};

type ManagerUpdatePayload = {
  role?: ManagerRole;
  isActive?: boolean;
};

function getStatus(unit: Unit): UnitStatus {
  // PRIORITY ORDER (matches backend)

  if (unit.paymentStatus === "FAILED") return "FAILED";
  if (unit.paymentStatus === "PENDING") return "PENDING";

  if (unit.balance <= 0) return "PAID";

  if (unit.isDelinquent) return "DELINQUENT";

  return "GRACE";
}

function getStatusDotClass(status: UnitStatus): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-500"; // green
    case "GRACE":
      return "bg-blue-500"; // blue
    case "PENDING":
      return "bg-yellow-400"; // yellow
    case "FAILED":
      return "bg-orange-500"; // orange
    case "DELINQUENT":
      return "bg-red-500"; // red
    default:
      return "bg-slate-400";
  }
}

function getStatusText(status: UnitStatus, daysPastDue: number): string {
  switch (status) {
    case "PAID":
      return "Paid";
    case "GRACE":
      return "In grace period";
    case "PENDING":
      return "Payment pending";
    case "FAILED":
      return "Payment failed";
    case "DELINQUENT":
      return `${daysPastDue} day${daysPastDue === 1 ? "" : "s"} past due`;
    default:
      return "—";
  }
}

function toMoney(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getLastName(tenantName: string | null): string {
  const trimmed = String(tenantName ?? "").trim();
  if (!trimmed) return "-";

  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] || trimmed;
}

function sortUnitsByUnitNumber(a: UnitWithStatus, b: UnitWithStatus): number {
  return a.unitNumber.localeCompare(b.unitNumber, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function slugifyTierName(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createTierDraft(tierName: string, index = 0): RentTierDraft {
  const safeName = String(tierName || `Tier ${index + 1}`).trim();

  return {
    id: `${slugifyTierName(safeName) || `tier-${index + 1}`}-${index}`,
    tierName: safeName,
    baseRent: "",
    dueDay: "1",
    graceDays: "5",
    lateFeeEnabled: false,
    lateFeeAmount: "",
  };
}

function urgencyBadgeClass(urgency: string): string {
  switch (urgency.toUpperCase()) {
    case "URGENT":
      return "border-red-200 bg-red-50 text-red-700";
    case "HIGH":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "LOW":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "NORMAL":
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function statusBadgeClass(status: string): string {
  switch (status.toUpperCase()) {
    case "COMPLETE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "THIRD_PARTY":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "OPEN":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function OverlayShell({
  title,
  subtitle,
  onClose,
  children,
  showFooter = true,
  onSave, // 👈 ADD THIS
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  showFooter?: boolean;
  onSave?: () => void; // 👈 ADD THIS
}) {

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-6">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[32px]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </div>

        {showFooter ? (
  <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6" />
) : null}
      </div>
    </div>
  );
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, next };
}



export default function Page() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<PanelKey>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitWithStatus | null>(null);
  const [manualPaymentAmount, setManualPaymentAmount] = useState("");
  const [showManualPaymentConfirm, setShowManualPaymentConfirm] = useState(false);
  const [submittingManualPayment, setSubmittingManualPayment] = useState(false);
  const [vacatingUnit, setVacatingUnit] = useState(false);
  const [showVacateConfirm, setShowVacateConfirm] = useState(false);
  const [vacateError, setVacateError] = useState("");
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [localTiers, setLocalTiers] = useState<RentTierDraft[]>([]);
  const [tierCharges, setTierCharges] = useState<TierChargesDraft[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [chargesError, setChargesError] = useState("");
  const [savingCharges, setSavingCharges] = useState(false);
  const [chargesEffectiveMonth, setChargesEffectiveMonth] = useState("");
  const viewMode: "full" = "full";
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [exportSelectedUnit, setExportSelectedUnit] = useState("");
  const [exportUnitError, setExportUnitError] = useState("");

  const bankValid =
  routingNumber.replace(/\D/g, "").length === 9 &&
  accountNumber &&
  accountNumber === confirmAccountNumber;

  const [gpLfSettings, setGpLfSettings] = useState({
  dueDay: "1",
  graceDays: "5",
  lateFeeEnabled: false,
  lateFeeInitial: "",
  lateFeeDaily: "",
  lateFeeMaxDays: "",
});

 const [gpLfTierMode, setGpLfTierMode] = useState<"all" | "selected">("all");
  const [gpLfSelectedTierIds, setGpLfSelectedTierIds] = useState<string[]>([]);
  const [savingGpLf, setSavingGpLf] = useState(false);
  const [gpLfSaveMessage, setGpLfSaveMessage] = useState("");

function updateGpLf(
  updates: Partial<typeof gpLfSettings>
): void {
  setGpLfSettings((prev) => ({
    ...prev,
    ...updates,
  }));
}

function toggleGpLfTierSelection(tierId: string): void {
  setGpLfSelectedTierIds((current) =>
    current.includes(tierId)
      ? current.filter((id) => id !== tierId)
      : [...current, tierId]
  );
}

function applyGpLfToTierDraft(tier: RentTierDraft): RentTierDraft {
  return {
    ...tier,
    dueDay: gpLfSettings.dueDay,
    graceDays: gpLfSettings.graceDays,
    lateFeeEnabled: gpLfSettings.lateFeeEnabled,
    lateFeeAmount: gpLfSettings.lateFeeInitial,
  };
}
  

  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersError, setManagersError] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<ManagerRole>("STAFF");
  const [creatingUser, setCreatingUser] = useState(false);

  const [maintenancePin, setMaintenancePin] = useState("");
  const [maintenancePinConfirm, setMaintenancePinConfirm] = useState("");
  const [maintenanceRequests, setMaintenanceRequests] = useState<
    MaintenanceRequestRow[]
  >([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState("");
  const [maintenanceActionId, setMaintenanceActionId] = useState("");
  const [maintenanceActionError, setMaintenanceActionError] = useState("");
  const [savingMaintenancePin, setSavingMaintenancePin] = useState(false);
  const [maintenancePinError, setMaintenancePinError] = useState("");
  const [maintenancePinSuccess, setMaintenancePinSuccess] = useState("");

  const sessionRole = data?.session?.role || "OWNER";
  const canManageMoney = sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canVacateUnit = sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canManageMaintenance =
    sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canEditRentSettings =
    sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canEditLateFeeSettings =
    sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canManageManagers = sessionRole === "OWNER";
  const isOwner = sessionRole === "OWNER";
  const propertyName = data?.property?.name ?? "Manager Dashboard";
  const propertyCode = data?.property?.code ?? "----";
  const bankConnected = data?.property?.paymentStatus?.bankConnected;

  const [exportMonth, setExportMonth] = useState(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
});
const [exportType, setExportType] = useState<"balances" | "ledger" | "payments">("balances");
const [exportUnitSearch, setExportUnitSearch] = useState("");
const [exporting, setExporting] = useState(false);

async function logout(): Promise<void> {
  try {
    await fetch("/api/manager/session", {
      method: "DELETE",
      credentials: "include",
    });
    window.location.href = "/";
  } catch {
    alert("Logout failed");
  }
}

  async function loadDashboard(): Promise<void> {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/manager/dashboard", {
        credentials: "include",
        cache: "no-store",
      });

      const json = (await response.json().catch(() => null)) as
        | DashboardData
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(
          json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to load dashboard."
        );
        setData(null);
        return;
      }

      setData(json as DashboardData);
    } catch {
      setError("Failed to load dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMaintenanceRequests(): Promise<void> {
    try {
      setMaintenanceLoading(true);
      setMaintenanceError("");
      setMaintenanceActionError("");

      const response = await fetch("/api/manager/maintenance", {
        credentials: "include",
        cache: "no-store",
      });

      const json = (await response.json().catch(() => null)) as
        | MaintenanceListResponse
        | null;

      if (!response.ok || !json?.ok) {
        setMaintenanceError(json?.error || "Failed to load maintenance.");
        setMaintenanceRequests([]);
        return;
      }

      setMaintenanceRequests(Array.isArray(json.requests) ? json.requests : []);
    } catch {
      setMaintenanceError("Failed to load maintenance.");
      setMaintenanceRequests([]);
    } finally {
      setMaintenanceLoading(false);
    }
  }

async function loadPropertyTiers(): Promise<void> {
  if (!data?.property?.id) return;

  try {
    const res = await fetch(`/api/admin/properties/${data.property.id}`, {
      credentials: "include",
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) return;

    const tiers = Array.isArray(json.tiers) ? json.tiers : [];

    if (!tiers.length) {
      setLocalTiers([createTierDraft("Tier 1", 0)]);
      return;
    }

   
    setLocalTiers(
      tiers.map(
        (
          tier: {
            id?: string;
            name?: string;
            baseRent?: number;
            rentDueDay?: number;
            gracePeriodDays?: number;
            lateFeeInitial?: number;
          },
          index: number
        ) => ({
          id: String(tier.id || `tier-${index}`),
          tierName: String(tier.name || `Tier ${index + 1}`),
          baseRent:
            typeof tier.baseRent === "number" ? String(tier.baseRent) : "",
          dueDay:
            typeof tier.rentDueDay === "number"
              ? String(tier.rentDueDay)
              : "1",
          graceDays:
            typeof tier.gracePeriodDays === "number"
              ? String(tier.gracePeriodDays)
              : "5",
          lateFeeEnabled:
            typeof tier.lateFeeInitial === "number" &&
            tier.lateFeeInitial > 0,
          lateFeeAmount:
            typeof tier.lateFeeInitial === "number" &&
            tier.lateFeeInitial > 0
              ? String(tier.lateFeeInitial)
              : "",
        })
      )
    );
  } catch {
    setLocalTiers([createTierDraft("Tier 1", 0)]);
  }
}

async function loadTierCharges(): Promise<void> {
  if (!data?.property?.id) return;

  try {
    setChargesLoading(true);
    setChargesError("");

    const res = await fetch(
      `/api/admin/properties/${data.property.id}/charges`,
      {
        credentials: "include",
        cache: "no-store",
      }
    );

    const json = (await res.json().catch(() => null)) as
      | PropertyChargesResponse
      | null;

    if (!res.ok || !json?.ok) {
      setChargesError(json?.error || "Failed to load charges.");
      setTierCharges([]);
      return;
    }

    const nextMonth = String(json?.nextEffectiveMonth || "");
    setChargesEffectiveMonth(nextMonth);

    const tiers = Array.isArray(json?.tiers) ? json.tiers : [];

    setTierCharges(
      tiers.map((tier, tierIndex) => ({
        tierId: String(tier.tierId || `tier-${tierIndex}`),
        tierName: String(tier.tierName || `Tier ${tierIndex + 1}`),
        charges: Array.isArray(tier.charges) && tier.charges.length > 0
          ? tier.charges.map((charge, chargeIndex) => ({
              id: String(charge.id || `charge-${tierIndex}-${chargeIndex}`),
              label: String(charge.label || ""),
              amount:
                typeof charge.amount === "number"
                  ? String(charge.amount)
                  : "",
            }))
          : [],
      }))
    );
  } catch {
    setChargesError("Failed to load charges.");
    setTierCharges([]);
  } finally {
    setChargesLoading(false);
  }
}

function updateTierCharge(
  tierId: string,
  chargeId: string,
  updates: Partial<AdditionalChargeDraft>
): void {
  setTierCharges((current) =>
    current.map((tier) =>
      tier.tierId === tierId
        ? {
            ...tier,
            charges: tier.charges.map((charge) =>
              charge.id === chargeId
                ? {
                    ...charge,
                    ...updates,
                  }
                : charge
            ),
          }
        : tier
    )
  );
}

function addTierCharge(tierId: string): void {
  setTierCharges((current) =>
    current.map((tier) =>
      tier.tierId === tierId
        ? {
            ...tier,
            charges: [...tier.charges, createChargeDraft(tier.charges.length)],
          }
        : tier
    )
  );
}

function removeTierCharge(tierId: string, chargeId: string): void {
  setTierCharges((current) =>
    current.map((tier) =>
      tier.tierId === tierId
        ? {
            ...tier,
            charges: tier.charges.filter((charge) => charge.id !== chargeId),
          }
        : tier
    )
  );
}

async function saveTierCharges(): Promise<void> {
  if (!data?.property?.id) return;

  try {
    setSavingCharges(true);
    setChargesError("");

    const res = await fetch(
      `/api/admin/properties/${data.property.id}/charges`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          tiers: tierCharges.map((tier) => ({
            tierId: tier.tierId,
            charges: tier.charges.map((charge) => ({
              label: charge.label,
              amount: charge.amount,
              isActive: true,
            })),
          })),
        }),
      }
    );

    const json = (await res.json().catch(() => null)) as
      | PropertyChargesResponse
      | null;

    if (!res.ok || !json?.ok) {
      setChargesError(json?.error || "Failed to save charges.");
      return;
    }

    if (typeof json.effectiveDate === "string") {
      setChargesEffectiveMonth(json.effectiveDate);
    }

    await loadTierCharges();
    alert("Charges saved");
  } catch {
    setChargesError("Failed to save charges.");
  } finally {
    setSavingCharges(false);
  }
} 

  async function submitVacateUnit(): Promise<void> {
    if (!selectedUnit || vacatingUnit || !canVacateUnit) return;

    try {
      setVacatingUnit(true);
      setVacateError("");

      const response = await fetch("/api/manager/units/vacate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          unitId: selectedUnit.unitId,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !json?.ok) {
        setVacateError(json?.error || "Failed to vacate unit.");
        return;
      }

      setData((current) => {
        if (!current) return current;

        return {
          ...current,
          units: current.units.map((unit) =>
            unit.unitId === selectedUnit.unitId
              ? {
                  ...unit,
                  tenantName: null,
                  balance: 0,
                  isDelinquent: false,
                  daysPastDue: 0,
                }
              : unit
          ),
        };
      });

      setShowVacateConfirm(false);
      closeUnitPanel();
    } catch {
      setVacateError("Failed to vacate unit.");
    } finally {
      setVacatingUnit(false);
    }
  }

  async function saveMaintenancePin(): Promise<void> {
    if (savingMaintenancePin || !canManageMaintenance) return;

    if (!/^\d{4}$/.test(maintenancePin)) {
      setMaintenancePinError("PIN must be exactly 4 digits.");
      setMaintenancePinSuccess("");
      return;
    }

    if (maintenancePin !== maintenancePinConfirm) {
      setMaintenancePinError("PIN and confirm PIN must match.");
      setMaintenancePinSuccess("");
      return;
    }

    try {
      setSavingMaintenancePin(true);
      setMaintenancePinError("");
      setMaintenancePinSuccess("");

      const response = await fetch("/api/manager/maintenance/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          pin: maintenancePin,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !json?.ok) {
        setMaintenancePinError(json?.error || "Failed to save maintenance PIN.");
        return;
      }

      setMaintenancePinSuccess("Maintenance PIN saved.");
      setMaintenancePin("");
      setMaintenancePinConfirm("");
    } catch {
      setMaintenancePinError("Failed to save maintenance PIN.");
    } finally {
      setSavingMaintenancePin(false);
    }
  }

  async function submitManualPayment(): Promise<void> {
    if (!selectedUnit || submittingManualPayment || !canManageMoney) return;

    const amount = Number(manualPaymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Invalid amount");
      return;
    }

    try {
      setSubmittingManualPayment(true);

      const response = await fetch("/api/manual-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          unitId: selectedUnit.unitId,
          amount,
          effectiveDate: new Date().toISOString().slice(0, 10),
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok) {
        alert(json?.error || "Payment failed");
        return;
      }

      const normalizedAmount = Math.round(amount * 100) / 100;

      setData((current) => {
        if (!current) return current;

        return {
          ...current,
          units: current.units.map((unit) =>
            unit.unitId === selectedUnit.unitId
              ? {
                  ...unit,
                  balance: Math.max(
                    0,
                    Math.round(
                      (Number(unit.balance || 0) - normalizedAmount) * 100
                    ) / 100
                  ),
                }
              : unit
          ),
        };
      });

      setShowManualPaymentConfirm(false);
      closeUnitPanel();
    } catch {
      alert("Payment error");
    } finally {
      setSubmittingManualPayment(false);
    }
  }

  async function runMaintenanceAction(
    requestId: string,
    action: MaintenanceAction
  ): Promise<void> {
    if (maintenanceActionId || !canManageMaintenance) return;

    try {
      setMaintenanceActionId(requestId);
      setMaintenanceActionError("");

      const body =
        action === "DELETE"
          ? { requestId, action: "DELETE" }
          : { requestId, status: action };

      const response = await fetch("/api/manager/maintenance/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = (await response.json().catch(() => null)) as
        | MaintenanceUpdateResponse
        | null;

      if (!response.ok || !json?.ok) {
        setMaintenanceActionError(
          json?.error || "Failed to update maintenance request."
        );
        return;
      }

      if (action === "DELETE") {
        setMaintenanceRequests((current) =>
          current.filter((request) => request.id !== requestId)
        );
        return;
      }

      setMaintenanceRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: action,
                updatedAt: new Date().toISOString(),
              }
            : request
        )
      );
    } catch {
      setMaintenanceActionError("Failed to update maintenance request.");
    } finally {
      setMaintenanceActionId("");
    }
  }

   function getExportMonthOptions(count = 12): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return { value, label };
  });
}

async function runExport(): Promise<void> {
  try {
    setExporting(true);

    const params = new URLSearchParams({
      month: exportMonth,
    });

    if (exportSelectedUnit.trim()) {
  params.set("unit", exportSelectedUnit.trim());
}

    const response = await fetch(`/api/exports/${exportType}?${params.toString()}`, {
      credentials: "include",
    });

    if (!response.ok) {
      alert("Export failed");
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rentfray-${exportType}-${exportMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    alert("Export failed");
  } finally {
    setExporting(false);
  }
}

const exportMonthOptions = getExportMonthOptions();

 
  async function loadManagers(): Promise<void> {
    try {
      if (!data?.property?.id) {
        setManagers([]);
        return;
      }

      setManagersLoading(true);
      setManagersError("");

      const res = await fetch(
        `/api/admin/properties/${data.property.id}/management-users`,
        {
          credentials: "include",
        }
      );

      const json = (await res.json().catch(() => null)) as
        | ManagersListResponse
        | null;

      if (!res.ok || !json?.ok) {
        setManagersError(json?.error || "Failed to load managers.");
        return;
      }

      setManagers(Array.isArray(json.users) ? json.users : []);
    } catch {
      setManagersError("Failed to load managers.");
    } finally {
      setManagersLoading(false);
    }
  }

  async function createManager(): Promise<void> {
    if (!newEmail || !newPassword || !data?.property?.id) return;

    try {
      setCreatingUser(true);

      const res = await fetch(
        `/api/admin/properties/${data.property.id}/management-users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: newEmail,
            password: newPassword,
            role: newRole,
          }),
        }
      );

      const json = (await res.json().catch(() => null)) as
        | ManagerMutationResponse
        | null;

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Failed to create user");
        return;
      }

      setNewEmail("");
      setNewPassword("");
      setNewRole("STAFF");

      await loadManagers();
    } finally {
      setCreatingUser(false);
    }
  }

  async function updateManager(
    userId: string,
    updates: ManagerUpdatePayload
  ): Promise<void> {
    try {
      if (!data?.property?.id) return;

      const res = await fetch(
        `/api/admin/properties/${data.property.id}/management-users`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            userId,
            ...updates,
          }),
        }
      );

      const json = (await res.json().catch(() => null)) as
        | ManagerMutationResponse
        | null;

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Update failed");
        return;
      }

      await loadManagers();
    } catch {
      alert("Update failed");
    }
  }

  useEffect(() => {
    if (activePanel === "manager" && canManageManagers) {
      void loadManagers();
    }
  }, [activePanel, canManageManagers]);

  useEffect(() => {
  (async () => {
    await loadDashboard();
  })();
}, []);

useEffect(() => {
  if (data?.property?.id) {
    void loadPropertyTiers();
  }
}, [data?.property?.id]);

  useEffect(() => {
    if (activePanel === "maint") {
      void loadMaintenanceRequests();
    }
  }, [activePanel]);

  useEffect(() => {
  if (activePanel === "charges") {
    void loadTierCharges();
  }
}, [activePanel, data?.property?.id]);

  const unitsWithStatus = useMemo<UnitWithStatus[]>(() => {
    if (!data?.units?.length) return [];

    return data.units
      .map((unit) => ({
        ...unit,
        status: getStatus(unit),
        displayLastName: getLastName(unit.tenantName),
      }))
      .sort(sortUnitsByUnitNumber);
  }, [data]);

  
  const tierGroups = useMemo<TierGroup[]>(() => {
    const groups = new Map<string, UnitWithStatus[]>();

    for (const unit of unitsWithStatus) {
      const tierName = String(unit.tierName ?? "").trim() || "Units";
      const existing = groups.get(tierName) ?? [];
      existing.push(unit);
      groups.set(tierName, existing);
    }

    return Array.from(groups.entries())
      .map(([tierName, units]) => ({
        tierName,
        units: [...units].sort(sortUnitsByUnitNumber),
      }))
      .sort((a, b) =>
        a.tierName.localeCompare(b.tierName, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
  }, [unitsWithStatus]);



  const sortedMaintenanceRequests = useMemo<MaintenanceRequestRow[]>(() => {
    return [...maintenanceRequests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [maintenanceRequests]);

  const stats = useMemo(() => {
    const totalUnits = unitsWithStatus.length;
    const occupiedUnits = unitsWithStatus.length;

const vacantUnits = 0;
    const tiers = tierGroups.length;

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      tiers,
    };
  }, [tierGroups.length, unitsWithStatus]);

  function openUnitPanel(unit: UnitWithStatus): void {
    setShowVacateConfirm(false);
    setVacateError("");
    setSelectedUnit(unit);
    setManualPaymentAmount(Number(unit.balance || 0).toFixed(2));
    setShowManualPaymentConfirm(false);
  }

function updateLocalTier(
  tierId: string,
  updates: Partial<RentTierDraft>
): void {
  setLocalTiers((current) =>
    current.map((tier) =>
      tier.id === tierId
        ? {
            ...tier,
            ...updates,
          }
        : tier
    )
  );
}

function createChargeDraft(index = 0): AdditionalChargeDraft {
  return {
    id: `charge-${index}-${Date.now()}`,
    label: "",
    amount: "",
  };
}

function formatMonthLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "next month";
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function addLocalTier(): void {
  setLocalTiers((current) => {
    const nextIndex = current.length;
    const newTier = createTierDraft(`Tier ${nextIndex + 1}`, nextIndex);
    return [...current, newTier];
  });
}

async function saveGpLfSettings(): Promise<void> {
  if (!data?.property?.id) return;

  const targetTierIds =
    gpLfTierMode === "all"
      ? localTiers.map((tier) => tier.id)
      : gpLfSelectedTierIds;

  if (targetTierIds.length === 0) {
    setGpLfSaveMessage("Select at least one tier.");
    return;
  }

  const nextTiers = localTiers.map((tier) =>
    targetTierIds.includes(tier.id) ? applyGpLfToTierDraft(tier) : tier
  );

  try {
    setSavingGpLf(true);
    setGpLfSaveMessage("");

    const res = await fetch(`/api/admin/properties/${data.property.id}/tiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tiers: nextTiers }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      setGpLfSaveMessage(json?.error || "Failed to save GP/LF settings.");
      return;
    }

    setLocalTiers(nextTiers);
    setGpLfSaveMessage("Grace period and late fee settings saved.");
  } catch {
    setGpLfSaveMessage("Failed to save GP/LF settings.");
  } finally {
    setSavingGpLf(false);
  }
}

async function saveLocalRentSettings(): Promise<void> {
  if (!data?.property?.id) return;

  try {
    const res = await fetch(
      `/api/admin/properties/${data.property.id}/tiers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          tiers: localTiers,
        }),
      }
    );

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      alert(json?.error || "Failed to save tiers");
      return;
    }

    setEditingTierId(null);
    alert("Saved");
  } catch {
    alert("Save failed");
  }
}
  function closeUnitPanel(): void {
    setShowVacateConfirm(false);
    setVacateError("");
    setSelectedUnit(null);
    setManualPaymentAmount("");
    setShowManualPaymentConfirm(false);
  }

  function openPanel(panel: Exclude<PanelKey, null>): void {
    setActivePanel(panel);
  }

  function closePanel(): void {
    setActivePanel(null);
    setMaintenanceError("");
    setMaintenanceActionError("");
    setMaintenancePin("");
    setMaintenancePinConfirm("");
    setMaintenancePinError("");
    setMaintenancePinSuccess("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm font-medium text-slate-600 shadow-sm">
          Loading dashboard...
        </div>
      </main>
    );
  }

if (error === "Unauthorized") {
  window.location.href = "/login/manager";
  return null;
}

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white px-6 py-5 text-sm text-red-700 shadow-sm">
          {error || "Failed to load dashboard."}
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-900 sm:px-5 sm:py-6">
        <div className="mx-auto max-w-6xl space-y-4">

             <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    RentFray manager
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    {propertyName}
                  </h1>
                  <div className="text-sm text-slate-600">
                    Property Code:{" "}
                    <span className="font-mono font-semibold text-slate-900">
                      {propertyCode}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    Role:{" "}
                    <span className="font-semibold text-slate-900">
                      {sessionRole}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openPanel("charges")}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    +
                  </button>

                  <button
                    type="button"
                    onClick={() => openPanel("rent")}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Rent
                  </button>

                  <button
                    type="button"
                    onClick={() => openPanel("gplf")}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    GP&amp;LF
                  </button>

                  <button
                    type="button"
                    onClick={() => openPanel("manager")}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Mngr
                  </button>

                  <button
                    onClick={() => openPanel("bank")}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Accnt
                  </button>

                  <button
                    type="button"
                    onClick={() => openPanel("info")}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Info
                  </button>

                  <button
                    type="button"
                    onClick={() => openPanel("maint")}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Maint
                  </button>

                  <button
                    onClick={logout}
                    className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                   Logout
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Total Units
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">
                  {data.summary?.totalUnits ?? stats.totalUnits}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Has used portal
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">
                  {data.summary?.occupiedUnits ?? stats.occupiedUnits}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Has not used portal
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">
                  {data.summary?.vacantUnits ?? stats.vacantUnits}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Tiers
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">
                  {data.tiers?.length ?? stats.tiers}
                </div>
              </div>
            </section>

           
              <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
  <div className="text-lg font-semibold text-slate-950">Current Cycle Snapshot</div>

  <div className="mt-4 space-y-3 text-sm">
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Billing cycle</span>
      <span className="font-semibold text-slate-950">
        {data.cycleSnapshot?.billingCycleLabel ?? "—"}
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Occupied units</span>
      <span className="font-semibold text-slate-950">
        {data.cycleSnapshot?.occupiedUnitsLabel ?? "—"}
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Paid through portal</span>
      <span className="font-semibold text-slate-950">
        {data.cycleSnapshot?.portalPaidCount ?? 0}
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Manual payments</span>
      <span className="font-semibold text-slate-950">
        {data.cycleSnapshot?.manualPaidCount ?? 0}
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Total paid</span>
      <span className="font-semibold text-slate-950">
        {data.cycleSnapshot?.totalPaidCount ?? 0}
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Unpaid units</span>
      <span className="font-semibold text-slate-950">
        {data.cycleSnapshot?.unpaidUnitsCount ?? 0}
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Total collected</span>
      <span className="font-semibold text-slate-950">
        {toMoney(data.cycleSnapshot?.totalCollected ?? 0)}
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Total expected</span>
      <span className="font-semibold text-slate-950">
        {toMoney(data.cycleSnapshot?.totalExpected ?? 0)}
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Collection %</span>
      <span className="font-semibold text-slate-950">
        {(data.cycleSnapshot?.collectionRate ?? 0).toFixed(1)}%
      </span>
    </div>

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="text-slate-600">Difference</span>
      <span
        className={`font-semibold ${
          (data.cycleSnapshot?.difference ?? 0) < 0
            ? "text-red-600"
            : "text-emerald-600"
        }`}
      >
        {(data.cycleSnapshot?.difference ?? 0) < 0 ? "-" : "+"}
        {toMoney(Math.abs(data.cycleSnapshot?.difference ?? 0))}
      </span>
    </div>
  </div>
</section>

            <section className="rounded-[28px] border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
              {tierGroups.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No units found.
                </div>
              ) : (
                <div className="space-y-4">
                  {tierGroups.map((group) => (
                    <div key={group.tierName} className="space-y-2">
                      <div className="px-1 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {group.tierName}
                      </div>

                      <div className="space-y-2">
                        {group.units.map((unit) => {
                         const vacant = false;
                          return (
                            <div
                              key={unit.unitId}
                              className="overflow-x-auto rounded-[22px] border border-slate-200 bg-slate-50"
                            >
                              <div className="flex min-w-[560px] items-center justify-between gap-3 px-3 py-3 sm:min-w-0">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={`h-3.5 w-3.5 shrink-0 rounded-full ${getStatusDotClass(
                                      unit.status
                                    )}`}
                                  />

                                  <button
                                    type="button"
                                    onClick={() => openUnitPanel(unit)}
                                    className="shrink-0 rounded-xl px-2 py-1 text-left text-base font-bold text-[#00d8ff] transition-all duration-150 hover:underline hover:shadow-[0_0_8px_#00d8ff] hover:scale-[1.05] cursor-pointer"
                                  >
                                    {unit.unitNumber}
                                  </button>

                                  <div className="min-w-[84px] truncate text-sm font-medium text-slate-700">
                                    {unit.displayLastName}
                                  </div>

                                  <div className="min-w-[110px] text-sm font-semibold text-slate-900">
                                    {vacant ? "-" : toMoney(unit.balance)}
                                  </div>

                                  <div className="hidden min-w-[120px] text-xs text-slate-500 sm:block">
                                    {getStatusText(unit.status, unit.daysPastDue)}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  {!vacant && canManageMoney ? (
                                    <button
                                      type="button"
                                      onClick={() => openUnitPanel(unit)}
                                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                    >
                                      MP
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
  <div className="text-lg font-semibold text-slate-950">Exports</div>
  <div className="mt-1 text-sm text-slate-600">
    Download balances, ledger, or payments by month.
  </div>

  <div className="mt-4 grid gap-3 sm:grid-cols-5">
    <select
      value={exportMonth}
      onChange={(e) => setExportMonth(e.target.value)}
      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
    >
      {exportMonthOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>

    <select
      value={exportType}
      onChange={(e) =>
        setExportType(e.target.value as "balances" | "ledger" | "payments")
      }
      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
    >
      <option value="balances">Balances</option>
      <option value="ledger">Ledger</option>
      <option value="payments">Payments</option>
    </select>

    <input
      type="text"
      value={exportUnitSearch}
      onChange={(e) => setExportUnitSearch(e.target.value)}
      placeholder="Search unit (optional)"
      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
    />

     <button
  type="button"
  onClick={() => {
  const value = exportUnitSearch.trim();

  const exists = data?.units?.some(
    (u) => u.unitNumber === value
  );

  if (!exists) {
    setExportUnitError("Unit not found");
    setExportSelectedUnit("");
    return;
  }

  setExportUnitError("");
  setExportSelectedUnit(value);
}}
  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
>
  Search
</button>

{exportSelectedUnit ? (
  <div className="text-sm font-semibold text-slate-800">
    Selected unit: {exportSelectedUnit}
  </div>
) : null}

    <button
      type="button"
      onClick={runExport}
      disabled={exporting}
      className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {exporting ? "Exporting..." : "Export"}
    </button>

    <button
  type="button"
  onClick={() => window.open("/tenant-instructions", "_blank")}
  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
>
  Tenant Instructions
</button>
</div>
</section>
           
     </div>
      </main>

      {selectedUnit ? (
        <OverlayShell
          title={`Unit ${selectedUnit.unitNumber}`}
          subtitle={`${selectedUnit.tenantName || "Tenant"} • ${getStatusText(
  selectedUnit.status,
  selectedUnit.daysPastDue
)}`}
          onClose={closeUnitPanel}
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Tenant
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {selectedUnit.tenantName || "-"}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Balance
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {toMoney(selectedUnit.balance)}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Tier
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {selectedUnit.tierName || "Units"}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Status
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {getStatusText(selectedUnit.status, selectedUnit.daysPastDue)}
                </div>
              </div>
            </div>

             <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
    Active
  </div>

  <button
    type="button"
    onClick={async () => {
      await fetch("/api/manager/units/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          unitId: selectedUnit.unitId,
          isActive: !selectedUnit.isActive,
        }),
      });

      await loadDashboard();
      closeUnitPanel();
    }}
    className="mt-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white"
  >
    {selectedUnit.isActive ? "Set Inactive" : "Reactivate"}
  </button>

    <button
  type="button"
  onClick={async () => {
    await fetch("/api/manager/units/toggle-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        unitId: selectedUnit.unitId,
        isActive: !selectedUnit.isActive,
      }),
    });

    await loadDashboard();
    closeUnitPanel();
  }}
  className="mt-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white"
>
  {selectedUnit.isActive ? "Set Inactive" : "Reactivate"}
</button>
</div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">
                Manual Payment
              </div>
            
              {!canManageMoney ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  View only. Only owner and manager can post manual payments.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Enter Amount
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={manualPaymentAmount}
                    onChange={(event) => {
                      setManualPaymentAmount(event.target.value);
                      setShowManualPaymentConfirm(false);
                    }}
                    disabled={!canManageMoney}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="0.00"
                  />
                </div>

                <button
                  type="button"
                  disabled={
  !canManageMoney ||
  !manualPaymentAmount.trim()
}
                  onClick={() => setShowManualPaymentConfirm(true)}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Confirm
                </button>
              </div>

              {showManualPaymentConfirm && canManageMoney ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">
                    Please confirm
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Manual payment of{" "}
                    <span className="font-semibold text-slate-950">
                      ${manualPaymentAmount}
                    </span>{" "}
                    for Unit{" "}
                    <span className="font-semibold text-slate-950">
                      {selectedUnit.unitNumber}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={submitManualPayment}
                      disabled={
                        submittingManualPayment ||
                        !manualPaymentAmount ||
                        Number(manualPaymentAmount) <= 0
                      }
                      className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {submittingManualPayment ? "Posting..." : "Yes"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowManualPaymentConfirm(false)}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">
                Vacate Unit
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                This action will remove tenant access, clear login credentials,
                mark the unit available, and preserve ledger history.
              </div>

              {!canVacateUnit ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  View only. Only owner and manager can vacate a unit.
                </div>
              ) : null}

              {vacateError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {vacateError}
                </div>
              ) : null}

              {!showVacateConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowVacateConfirm(true)}
                  disabled={!canVacateUnit}
                  className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Vacate Unit
                </button>
              ) : canVacateUnit ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">
                    Make Unit {selectedUnit.unitNumber} vacant?
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    • Removes tenant access
                    <br />
                    • Clears login credentials
                    <br />
                    • Marks unit as available
                    <br />
                    • Saves move-out record
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={submitVacateUnit}
                      disabled={vacatingUnit}
                      className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {vacatingUnit ? "Vacating..." : "Confirm"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowVacateConfirm(false)}
                      disabled={vacatingUnit}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">
                Maintenance History
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                Unit-level maintenance history will populate here when the
                maintenance routes are wired into the new overlay system.
              </div>
            </div>
          </div>
        </OverlayShell>
      ) : null}

     {activePanel === "bank" ? (
  <OverlayShell title="Bank Account" onClose={closePanel} showFooter={false}>
    <div className="space-y-4 pb-24">

      <div className="text-sm font-semibold">
      Status: {data?.property?.paymentStatus?.bankConnected ? "Connected" : "Not connected"}
     </div>

      <input
         placeholder="Routing Number"
         value={routingNumber}
         onChange={(e) => setRoutingNumber(e.target.value)}
         className="w-full border p-3 rounded-xl"
         disabled={!isOwner}
          />

      <input
        placeholder="Account Number"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value)}
        className="w-full border p-3 rounded-xl"
        disabled={!isOwner}
      />

      <input
        placeholder="Confirm Account Number"
        value={confirmAccountNumber}
        onChange={(e) => setConfirmAccountNumber(e.target.value)}
        className="w-full border p-3 rounded-xl"
        disabled={!isOwner}
      />

      <button
  type="button"
  disabled={!bankValid || !isOwner}
  className="w-full rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
  onClick={async () => {
    if (!bankValid) return;

    const cleanRouting = routingNumber.replace(/\D/g, "");
    const cleanAccount = accountNumber.trim();

    const res = await fetch("/api/stripe/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routingNumber: cleanRouting,
        accountNumber: cleanAccount,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      alert(json?.error || "Failed to start bank connection");
      return;
    }

    if (json?.url) {
      window.location.href = json.url;
    }
  }}
>
  Save
</button>

    </div>
  </OverlayShell>
) : null}

{activePanel === "charges" ? (
  <OverlayShell
    title="Additional Charges"
    subtitle={`Tier-based recurring charges that begin on ${formatMonthLabel(
      chargesEffectiveMonth
    )}`}
    onClose={closePanel}
    showFooter={false}
  >
    <div className="space-y-4">
      {chargesLoading ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading charges...
        </div>
      ) : null}

      {chargesError ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {chargesError}
        </div>
      ) : null}

      {!chargesLoading && tierCharges.length === 0 ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No tiers found.
        </div>
      ) : null}

      {tierCharges.map((tier) => (
        <div
          key={tier.tierId}
          className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                {tier.tierName}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Changes apply on the 1st of the following month.
              </div>
            </div>

            <button
              type="button"
              onClick={() => addTierCharge(tier.tierId)}
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Add Charge
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {tier.charges.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                No additional charges for this tier.
              </div>
            ) : (
              tier.charges.map((charge) => (
                <div
                  key={charge.id}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_140px_auto]"
                >
                  <input
                    type="text"
                    value={charge.label}
                    onChange={(event) =>
                      updateTierCharge(tier.tierId, charge.id, {
                        label: event.target.value,
                      })
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-950"
                    placeholder="Charge label"
                  />

                  <input
                    type="text"
                    inputMode="decimal"
                    value={charge.amount}
                    onChange={(event) =>
                      updateTierCharge(tier.tierId, charge.id, {
                        amount: event.target.value.replace(/[^0-9.]/g, ""),
                      })
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-950"
                    placeholder="0.00"
                  />

                  <button
                    type="button"
                    onClick={() => removeTierCharge(tier.tierId, charge.id)}
                    className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={saveTierCharges}
        disabled={savingCharges}
        className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {savingCharges ? "Saving..." : "Save Changes"}
      </button>
    </div>
  </OverlayShell>
) : null}      

{activePanel === "rent" ? (
  <OverlayShell
    title="Rent Panel"
    subtitle="Tier rent settings and add-tier controls."
    onClose={closePanel}
    showFooter={false}
  >
    <div className="space-y-4">
      {!canEditRentSettings ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          View only. Only owner and manager can change rent settings.
        </div>
      ) : null}

      {localTiers.map((tier) => {
        const isEditing = editingTierId === tier.id;

        return (
          <div
            key={tier.id}
            className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-950">
                {tier.tierName || "Untitled Tier"}
              </div>

              <button
                type="button"
                onClick={() =>
                  setEditingTierId(isEditing ? null : tier.id)
                }
                disabled={!canEditRentSettings}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isEditing ? "Done" : "Change"}
              </button>
            </div>

            {isEditing ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Tier Name
                  </label>
                  <input
                    type="text"
                    value={tier.tierName}
                    onChange={(event) =>
                      updateLocalTier(tier.id, {
                        tierName: event.target.value,
                      })
                    }
                    disabled={!canEditRentSettings}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="Tier name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Base Rent
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tier.baseRent}
                    onChange={(event) =>
                      updateLocalTier(tier.id, {
                        baseRent: event.target.value.replace(/[^0-9.]/g, ""),
                      })
                    }
                    disabled={!canEditRentSettings}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Due Day
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tier.dueDay}
                    onChange={(event) =>
                      updateLocalTier(tier.id, {
                        dueDay: event.target.value.replace(/\D/g, "").slice(0, 2),
                      })
                    }
                    disabled={!canEditRentSettings}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="1"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Grace Days
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tier.graceDays}
                    onChange={(event) =>
                      updateLocalTier(tier.id, {
                        graceDays: event.target.value.replace(/\D/g, "").slice(0, 2),
                      })
                    }
                    disabled={!canEditRentSettings}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="5"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={tier.lateFeeEnabled}
                      onChange={(event) =>
                        updateLocalTier(tier.id, {
                          lateFeeEnabled: event.target.checked,
                        })
                      }
                      disabled={!canEditRentSettings}
                    />
                    <span className="text-sm font-medium text-slate-800">
                      Late fee enabled
                    </span>
                  </label>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Late Fee Amount
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tier.lateFeeAmount}
                    onChange={(event) =>
                      updateLocalTier(tier.id, {
                        lateFeeAmount: event.target.value.replace(/[^0-9.]/g, ""),
                      })
                    }
                    disabled={!canEditRentSettings || !tier.lateFeeEnabled}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  Base Rent:{" "}
                  <span className="font-semibold text-slate-900">
                    {tier.baseRent ? `$${tier.baseRent}` : "—"}
                  </span>
                </div>
                <div>
                  Due Day:{" "}
                  <span className="font-semibold text-slate-900">
                    {tier.dueDay || "—"}
                  </span>
                </div>
                <div>
                  Grace Days:{" "}
                  <span className="font-semibold text-slate-900">
                    {tier.graceDays || "—"}
                  </span>
                </div>
                <div>
                  Late Fee:{" "}
                  <span className="font-semibold text-slate-900">
                    {tier.lateFeeEnabled
                      ? tier.lateFeeAmount
                        ? `$${tier.lateFeeAmount}`
                        : "Enabled"
                      : "Off"}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addLocalTier}
          disabled={!canEditRentSettings}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Add Tier
        </button>

        <button
          type="button"
          onClick={saveLocalRentSettings}
          disabled={!canEditRentSettings}
          className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Save Changes
        </button>
      </div>
    </div>
  </OverlayShell>
) : null}

      {activePanel === "gplf" ? (
  <OverlayShell
    title="Grace Period & Late Fees"
    onClose={closePanel}
  >
    <div className="space-y-5">
      
     <div className="flex justify-end">

  <select
    value={gpLfTierMode}
    onChange={(e) =>
      setGpLfTierMode(e.target.value as "all" | "selected")
    }
    disabled={!canEditLateFeeSettings}
    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 disabled:bg-slate-100"
  >
    <option value="all">Apply to all tiers</option>
    <option value="selected">Apply to selected tiers</option>
  </select>
</div>

{gpLfTierMode === "selected" ? (
  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
    <div className="mb-3 text-sm font-semibold text-slate-900">
      Select the tiers this applies to:
    </div>
    <div className="flex flex-wrap gap-2">
      {localTiers.map((tier) => (
        <label
          key={tier.id}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            checked={gpLfSelectedTierIds.includes(tier.id)}
            onChange={() => toggleGpLfTierSelection(tier.id)}
            disabled={!canEditLateFeeSettings}
          />
          <span>{tier.tierName}</span>
        </label>
      ))}
    </div>
  </div>
) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Due Day
          </label>
          <input
            type="number"
            min="1"
            max="31"
            value={gpLfSettings.dueDay}
            onChange={(e) => updateGpLf({ dueDay: e.target.value })}
            disabled={!canEditLateFeeSettings}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Grace Days
          </label>
          <input
            type="number"
            min="0"
            max="31"
            value={gpLfSettings.graceDays}
            onChange={(e) => updateGpLf({ graceDays: e.target.value })}
            disabled={!canEditLateFeeSettings}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Enable Late Fees
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Turn on initial and daily late fee rules.
            </div>
          </div>

          <input
            type="checkbox"
            checked={gpLfSettings.lateFeeEnabled}
            onChange={(e) =>
              updateGpLf({ lateFeeEnabled: e.target.checked })
            }
            disabled={!canEditLateFeeSettings}
            className="h-5 w-5 rounded border-slate-300"
          />
        </label>
      </div>

      {gpLfSettings.lateFeeEnabled ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Initial Late Fee
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gpLfSettings.lateFeeInitial}
              onChange={(e) =>
                updateGpLf({ lateFeeInitial: e.target.value })
              }
              disabled={!canEditLateFeeSettings}
              placeholder="0.00"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Daily Late Fee
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gpLfSettings.lateFeeDaily}
              onChange={(e) =>
                updateGpLf({ lateFeeDaily: e.target.value })
              }
              disabled={!canEditLateFeeSettings}
              placeholder="0.00"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Max Daily Fee Days
            </label>
            <input
              type="number"
              min="0"
              max="365"
              value={gpLfSettings.lateFeeMaxDays}
              onChange={(e) =>
                updateGpLf({ lateFeeMaxDays: e.target.value })
              }
              disabled={!canEditLateFeeSettings}
              placeholder="0"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
            />
          </div>
        </div>
      ) : null}

      <button
  type="button"
  onClick={saveGpLfSettings}
  disabled={!canEditLateFeeSettings || savingGpLf}
  className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:translate-y-px active:bg-blue-700 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
>
  {savingGpLf ? "Saving..." : "Save Changes"}
</button>

{gpLfSaveMessage ? (
  <div className="text-sm text-slate-600">{gpLfSaveMessage}</div>
) : null}

    </div>
  </OverlayShell>
) : null}


      {activePanel === "manager" ? (
        <OverlayShell
          title="Managers"
          subtitle="Owner-controlled account management."
          onClose={closePanel}
        >
          <div className="space-y-4">
            {!canManageManagers ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                View only. Only the owner can manage manager accounts and roles.
              </div>
            ) : null}

            {canManageManagers ? (
  <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
    <div className="text-sm font-semibold text-slate-950">
      Add Manager / Staff
    </div>

    <input
      type="email"
      placeholder="Email"
      value={newEmail}
      onChange={(e) => setNewEmail(e.target.value)}
      className="rounded-xl border px-3 py-2 text-sm"
    />

    <input
      placeholder="Password"
      type="password"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      className="rounded-xl border px-3 py-2 text-sm"
    />

    <select
      value={newRole}
      onChange={(e) => setNewRole(e.target.value as ManagerRole)}
      className="rounded-xl border px-3 py-2 text-sm"
    >
      <option value="MANAGER">Manager</option>
      <option value="STAFF">Staff</option>
    </select>

    <button
      type="button"
      onClick={createManager}
      disabled={creatingUser}
      className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
    >
      {creatingUser ? "Creating..." : "Create"}
    </button>
  </div>
) : null}

            {managersLoading ? (
              <div className="text-sm text-slate-600">Loading...</div>
            ) : managersError ? (
              <div className="text-sm text-red-600">{managersError}</div>
            ) : (
              <div className="space-y-2">
                {managers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50 p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold">{user.username}</div>
                      <div className="text-xs text-slate-600">
                        {user.role} • {user.isActive ? "Active" : "Disabled"}
                      </div>
                    </div>

                    {canManageManagers ? (
                      <div className="flex gap-2">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            void updateManager(user.id, {
                              role: e.target.value as ManagerRole,
                            })
                          }
                          className="rounded border px-2 py-1 text-xs"
                        >
                          <option value="MANAGER">Manager</option>
                          <option value="STAFF">Staff</option>
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            void updateManager(user.id, {
                              isActive: !user.isActive,
                            })
                          }
                          className="rounded border px-2 py-1 text-xs"
                        >
                          {user.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </OverlayShell>
      ) : null}

      {activePanel === "info" ? (
        <OverlayShell
          title="Property Info"
          subtitle="Read-only property info, legends, and fee ranges."
          onClose={closePanel}
        >
          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Property Name
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950">
                {propertyName}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Property Code
              </div>
              <div className="mt-2 font-mono text-lg font-semibold text-slate-950">
                {propertyCode}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
  <div className="text-sm font-semibold text-slate-900">Status Legend</div>

  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full bg-emerald-500" />
      Paid
    </div>

    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full bg-blue-500" />
      In grace period
    </div>

    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full bg-yellow-400" />
      Payment pending
    </div>

    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full bg-orange-500" />
      Payment failed
    </div>

    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full bg-red-500" />
      Past due
    </div>
  </div>
</div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-950">
                Processing Fee Legend
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <div>&lt; $100 → $2.95</div>
                <div>$100–199 → $3.95</div>
                <div>$200–299 → $4.95</div>
                <div>$300–399 → $5.95</div>
                <div>$400–499 → $6.95</div>
                <div>$500–799 → $7.95</div>
                <div>$800–899 → $8.95</div>
                <div>$900+ → $9.95</div>
              </div>
            </div>
          </div>
        </OverlayShell>
      ) : null}

      {activePanel === "maint" ? (
        <OverlayShell
          title="Maintenance"
          subtitle="Set maintenance PIN and review work orders."
          onClose={closePanel}
        >
          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-950">
                Set PIN
              </div>

              {!canManageMaintenance ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  View only. Only owner and manager can set PIN or update
                  maintenance requests.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={maintenancePin}
                  onChange={(event) => {
                    setMaintenancePin(
                      event.target.value.replace(/\D/g, "").slice(0, 4)
                    );
                    setMaintenancePinError("");
                    setMaintenancePinSuccess("");
                  }}
                  disabled={!canManageMaintenance}
                  placeholder="PIN"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={maintenancePinConfirm}
                  onChange={(event) => {
                    setMaintenancePinConfirm(
                      event.target.value.replace(/\D/g, "").slice(0, 4)
                    );
                    setMaintenancePinError("");
                    setMaintenancePinSuccess("");
                  }}
                  disabled={!canManageMaintenance}
                  placeholder="Confirm PIN"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              {maintenancePinError ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {maintenancePinError}
                </div>
              ) : null}

              {maintenancePinSuccess ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {maintenancePinSuccess}
                </div>
              ) : null}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={saveMaintenancePin}
                  disabled={
                    !canManageMaintenance ||
                    savingMaintenancePin ||
                    maintenancePin.length !== 4 ||
                    maintenancePinConfirm.length !== 4
                  }
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingMaintenancePin ? "Saving..." : "Save PIN"}
                </button>
              </div>
            </div>

            {maintenanceError ? (
              <div className="rounded-[24px] border border-red-200 bg-white px-4 py-4 text-sm text-red-700 shadow-sm">
                {maintenanceError}
              </div>
            ) : null}

            {maintenanceActionError ? (
              <div className="rounded-[24px] border border-red-200 bg-white px-4 py-4 text-sm text-red-700 shadow-sm">
                {maintenanceActionError}
              </div>
            ) : null}

            {maintenanceLoading ? (
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600 shadow-sm">
                Loading maintenance requests...
              </div>
            ) : sortedMaintenanceRequests.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                No maintenance requests.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedMaintenanceRequests.map((request) => {
                  const isBusy = maintenanceActionId === request.id;
                  const isComplete =
                    request.status.toUpperCase() === "COMPLETE";
                  const isInProgress =
                    request.status.toUpperCase() === "IN_PROGRESS";

                  return (
                    <div
                      key={request.id}
                      className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-semibold text-slate-950">
                                Unit {request.unitNumber}
                              </div>

                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusBadgeClass(
                                  request.status
                                )}`}
                              >
                                {request.status.replace("_", " ")}
                              </span>

                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${urgencyBadgeClass(
                                  request.urgency
                                )}`}
                              >
                                {request.urgency}
                              </span>
                            </div>

                            <div className="mt-2 text-sm font-medium text-slate-800">
                              {request.category}
                            </div>

                            <div className="mt-1 text-sm text-slate-600">
                              {request.tenantName || "No tenant name available"}
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 sm:text-right">
                            <div>Created {formatDate(request.createdAt)}</div>
                            <div className="mt-1">
                              Updated {formatDate(request.updatedAt)}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                          {request.description}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!isInProgress && !isComplete ? (
                            <button
                              type="button"
                              onClick={() =>
                                void runMaintenanceAction(
                                  request.id,
                                  "IN_PROGRESS"
                                )
                              }
                              disabled={isBusy || !canManageMaintenance}
                              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isBusy ? "Updating..." : "3rd Party / In Progress"}
                            </button>
                          ) : null}

                          {!isComplete ? (
                            <button
                              type="button"
                              onClick={() =>
                                void runMaintenanceAction(
                                  request.id,
                                  "COMPLETE"
                                )
                              }
                              disabled={isBusy || !canManageMaintenance}
                              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {isBusy ? "Updating..." : "Completed"}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              void runMaintenanceAction(request.id, "DELETE")
                            }
                            disabled={isBusy || !canManageMaintenance}
                            className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {isBusy ? "Updating..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </OverlayShell>
      ) : null}
    </>
  );
}