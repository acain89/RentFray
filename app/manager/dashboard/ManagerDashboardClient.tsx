"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

export const dynamic = "force-dynamic";

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
  unitCount: number;
  managementUsers?: {
    id: string;
    role: string;
    email: string | null;
    username: string;
    displayName: string | null;
  }[];
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
  lateFeeDaily: string;
  lateFeeMaxDays: string;
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

type InactiveUnitRow = {
  id: string;
  unitNumber: string;
  tierName: string;
  lastActiveAt: string;
};

type InactiveUnitsResponse = {
  ok?: boolean;
  error?: string;
  units?: InactiveUnitRow[];
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
    lateFeeDaily: "",
    lateFeeMaxDays: "",
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
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  showFooter?: boolean;
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
  const [showInactiveConfirm, setShowInactiveConfirm] = useState(false);
  const [togglingUnitActive, setTogglingUnitActive] = useState(false);
  const [vacateError, setVacateError] = useState("");
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [localTiers, setLocalTiers] = useState<RentTierDraft[]>([]);
  const [tierCharges, setTierCharges] = useState<TierChargesDraft[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [chargesError, setChargesError] = useState("");
  const [savingCharges, setSavingCharges] = useState(false);
  const [chargesEffectiveMonth, setChargesEffectiveMonth] = useState("");
  const viewMode: "full" = "full";
  const [exportSelectedUnit, setExportSelectedUnit] = useState("");
  const [exportUnitError, setExportUnitError] = useState("");
  const [showChangeLogin, setShowChangeLogin] = useState(false);
  const [changeCurrentLogin, setChangeCurrentLogin] = useState("");
  const [changeCurrentPassword, setChangeCurrentPassword] = useState("");
  const [changeNewEmail, setChangeNewEmail] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [changeConfirmPassword, setChangeConfirmPassword] = useState("");
  const [showInactiveUnits, setShowInactiveUnits] = useState(false);
  const [inactiveUnits, setInactiveUnits] = useState<InactiveUnitRow[]>([]);
  const [inactiveUnitsLoading, setInactiveUnitsLoading] = useState(false);
  const [inactiveUnitsError, setInactiveUnitsError] = useState("");
  const [inactiveActionUnitId, setInactiveActionUnitId] = useState("");
  const [confirmReactivateUnitId, setConfirmReactivateUnitId] = useState("");
  const [confirmDeleteUnitId, setConfirmDeleteUnitId] = useState("");


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
    lateFeeDaily: gpLfSettings.lateFeeDaily,
    lateFeeMaxDays: gpLfSettings.lateFeeMaxDays,
  };
}  

function getGpLfSettingsFromTiers(tiers: RentTierDraft[]) {
  const source =
    tiers.find(
      (t) =>
        t.lateFeeEnabled ||
        Number(t.lateFeeAmount || 0) > 0 ||
        Number(t.lateFeeDaily || 0) > 0 ||
        Number(t.lateFeeMaxDays || 0) > 0
    ) ?? tiers[0];

  if (!source) {
    return {
      dueDay: "1",
      graceDays: "5",
      lateFeeEnabled: false,
      lateFeeInitial: "",
      lateFeeDaily: "",
      lateFeeMaxDays: "",
    };
  }

  return {
    dueDay: source.dueDay || "1",
    graceDays: source.graceDays || "5",
    lateFeeEnabled:
      source.lateFeeEnabled ||
      Number(source.lateFeeAmount || 0) > 0 ||
      Number(source.lateFeeDaily || 0) > 0,
    lateFeeInitial: source.lateFeeAmount || "",
    lateFeeDaily: source.lateFeeDaily || "",
    lateFeeMaxDays: source.lateFeeMaxDays || "",
  };
}

  type GpLfTierSnapshot = {
  id: string;
  tierName: string;
  dueDay: string;
  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeInitial: string;
  lateFeeDaily: string;
  lateFeeMaxDays: string;
};

function formatGpLfMoney(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "$0.00";
}

function getGpLfTierSnapshot(tier: RentTierDraft): GpLfTierSnapshot {
  return {
    id: tier.id,
    tierName: tier.tierName,
    dueDay: tier.dueDay || "1",
    graceDays: tier.graceDays || "0",
    lateFeeEnabled: Boolean(tier.lateFeeEnabled),
    lateFeeInitial: tier.lateFeeAmount || "0",
    lateFeeDaily: tier.lateFeeDaily || "0",
    lateFeeMaxDays: tier.lateFeeMaxDays || "0",
  };
}

function getMixedText(values: string[]): string {
  const unique = Array.from(new Set(values.map((value) => String(value).trim())));
  return unique.length <= 1 ? (unique[0] || "—") : "Mixed";
}

function getMixedBooleanText(values: boolean[]): string {
  const unique = Array.from(new Set(values));
  return unique.length <= 1 ? (unique[0] ? "Enabled" : "Disabled") : "Mixed";
}

  const managers = data?.property?.managementUsers ?? [];
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
  const [pendingUnitCount, setPendingUnitCount] = useState<number | null>(null);
  const [updatingUnitCount, setUpdatingUnitCount] = useState(false);
  const propertyCode = data?.property?.code ?? "----";
  const bankConnected = data?.property?.paymentStatus?.bankConnected;
  const bankStatus = data?.property?.paymentStatus?.bankStatus;
  const bankMessage = data?.property?.paymentStatus?.bankMessage;

  const activeUnitCount = useMemo(() => {
  return Array.isArray(data?.units)
    ? data.units.filter((unit) => unit.isActive).length
    : 0;
}, [data?.units]);

  const [exportMonth, setExportMonth] = useState(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
});
const [exportType, setExportType] = useState<"balances" | "ledger" | "payments">("balances");
const [exportUnitSearch, setExportUnitSearch] = useState("");
const [exporting, setExporting] = useState(false);

async function updateUnitCount(next: number): Promise<void> {
  if (data?.property?.unitCount == null) return;
  if (updatingUnitCount) return;

  const confirmed = window.confirm(
    `Update total units to ${next}?`
  );

  if (!confirmed) return;

  try {
    setUpdatingUnitCount(true);

    const res = await fetch("/api/manager/property/unit-count", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ unitCount: next }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      alert(json?.error || "Failed to update unit count.");
      return;
    }

    await loadDashboard();
  } catch {
    alert("Failed to update unit count.");
  } finally {
    setUpdatingUnitCount(false);
  }
}

async function connectBank(): Promise<void> {
  try {
    const res = await fetch("/api/stripe/connect", {
      method: "POST",
      credentials: "include",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok || !json?.url) {
      alert(json?.error || "Failed to start bank connection.");
      return;
    }

    window.location.href = json.url;
  } catch {
    alert("Failed to start bank connection.");
  }
}

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
            lateFeeInitialCents?: number;
            lateFeeDaily?: number;
            lateFeeDailyCents?: number;
            lateFeeMaxDays?: number;
            maxLateFeeDays?: number;
          },
          index: number
        ) => {
          const initialCents =
            typeof tier.lateFeeInitialCents === "number"
              ? tier.lateFeeInitialCents
              : typeof tier.lateFeeInitial === "number"
                ? Math.round(tier.lateFeeInitial * 100)
                : 0;

          const dailyCents =
            typeof tier.lateFeeDailyCents === "number"
              ? tier.lateFeeDailyCents
              : typeof tier.lateFeeDaily === "number"
                ? Math.round(tier.lateFeeDaily * 100)
                : 0;

          const maxDays =
            typeof tier.maxLateFeeDays === "number"
              ? tier.maxLateFeeDays
              : typeof tier.lateFeeMaxDays === "number"
                ? tier.lateFeeMaxDays
                : 0;

          return {
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
            lateFeeEnabled: initialCents > 0 || dailyCents > 0,
            lateFeeAmount: initialCents > 0 ? String(initialCents / 100) : "",
            lateFeeDaily: dailyCents > 0 ? String(dailyCents / 100) : "",
            lateFeeMaxDays: maxDays > 0 ? String(maxDays) : "",
          };
        }
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

async function submitToggleUnitActive(): Promise<void> {
  if (!selectedUnit || togglingUnitActive || !canVacateUnit) return;

  try {
    setTogglingUnitActive(true);

    const response = await fetch("/api/manager/units/toggle-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        unitId: selectedUnit.unitId,
        isActive: !selectedUnit.isActive,
      }),
    });

    const json = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!response.ok || !json?.ok) {
      alert(json?.error || "Failed to update unit status.");
      return;
    }

    await loadDashboard();
    setShowInactiveConfirm(false);
    closeUnitPanel();
  } catch {
    alert("Failed to update unit status.");
  } finally {
    setTogglingUnitActive(false);
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

      await loadDashboard();
    } finally {
      setCreatingUser(false);
    }
  }

  async function submitChangeLogin(): Promise<void> {
  try {
    const res = await fetch("/api/manager/account/change-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
  currentLogin: changeCurrentLogin,
  currentPassword: changeCurrentPassword,
  newEmail: changeNewEmail,
  newPassword: changeNewPassword,
  confirmPassword: changeConfirmPassword,
}),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      alert(json?.error || "Failed to update login");
      return;
    }

    alert("Login updated successfully");

    setChangeCurrentLogin("");
    setChangeCurrentPassword("");
    setChangeNewEmail("");
    setChangeNewPassword("");
    setChangeConfirmPassword("");
    setShowChangeLogin(false);
  } catch {
    alert("Failed to update login");
  }
}

async function loadInactiveUnits(): Promise<void> {
  try {
    setInactiveUnitsLoading(true);
    setInactiveUnitsError("");

    const res = await fetch("/api/manager/units/inactive", {
      credentials: "include",
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as
      | InactiveUnitsResponse
      | null;

    if (!res.ok || !json?.ok) {
      setInactiveUnitsError(json?.error || "Failed to load inactive units.");
      setInactiveUnits([]);
      return;
    }

    setInactiveUnits(Array.isArray(json.units) ? json.units : []);
  } catch {
    setInactiveUnitsError("Failed to load inactive units.");
    setInactiveUnits([]);
  } finally {
    setInactiveUnitsLoading(false);
  }
}

async function reactivateInactiveUnit(unitId: string): Promise<void> {
  try {
    setInactiveActionUnitId(unitId);

    const res = await fetch("/api/manager/units/toggle-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        unitId,
        isActive: true,
      }),
    });

    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!res.ok || !json?.ok) {
      alert(json?.error || "Failed to reactivate unit.");
      return;
    }

    setConfirmReactivateUnitId("");
    await loadInactiveUnits();
    await loadDashboard();
  } catch {
    alert("Failed to reactivate unit.");
  } finally {
    setInactiveActionUnitId("");
  }
}

async function deleteInactiveUnit(unitId: string): Promise<void> {
  try {
    setInactiveActionUnitId(unitId);

    const res = await fetch("/api/manager/units/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        unitId,
      }),
    });

    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!res.ok || !json?.ok) {
      alert(json?.error || "Failed to delete inactive unit.");
      return;
    }

    setConfirmDeleteUnitId("");
    await loadInactiveUnits();
  } catch {
    alert("Failed to delete inactive unit.");
  } finally {
    setInactiveActionUnitId("");
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

      await loadDashboard();
    } catch {
      alert("Update failed");
    }
  }

 
useEffect(() => {
  if (
    activePanel === "manager" &&
    showInactiveUnits &&
    (sessionRole === "OWNER" || sessionRole === "MANAGER")
  ) {
    void loadInactiveUnits();
  }
}, [activePanel, showInactiveUnits, sessionRole]);

useEffect(() => {
  (async () => {
    await loadDashboard();
  })();
}, []);

useEffect(() => {
  if (!data) return;

  const configuredUnitCount = Number(data.property?.unitCount ?? 0);

  setPendingUnitCount(configuredUnitCount);
}, [data]);

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

   const gpLfVisibleTierIds = useMemo<string[]>(() => {
  return gpLfTierMode === "all"
    ? localTiers.map((tier) => tier.id)
    : gpLfSelectedTierIds;
}, [gpLfTierMode, gpLfSelectedTierIds, localTiers]);

const gpLfVisibleTiers = useMemo<GpLfTierSnapshot[]>(() => {
  return localTiers
    .filter((tier) => gpLfVisibleTierIds.includes(tier.id))
    .map(getGpLfTierSnapshot);
}, [gpLfVisibleTierIds, localTiers]);

const gpLfComparisonSummary = useMemo(() => {
  if (gpLfVisibleTiers.length === 0) {
    return null;
  }

  return {
    dueDay: getMixedText(gpLfVisibleTiers.map((tier) => tier.dueDay)),
    graceDays: getMixedText(gpLfVisibleTiers.map((tier) => tier.graceDays)),
    lateFeeStatus: getMixedBooleanText(
      gpLfVisibleTiers.map((tier) => tier.lateFeeEnabled)
    ),
    lateFeeInitial: getMixedText(
      gpLfVisibleTiers.map((tier) => tier.lateFeeInitial)
    ),
    lateFeeDaily: getMixedText(
      gpLfVisibleTiers.map((tier) => tier.lateFeeDaily)
    ),
    lateFeeMaxDays: getMixedText(
      gpLfVisibleTiers.map((tier) => tier.lateFeeMaxDays)
    ),
  };
}, [gpLfVisibleTiers]);

  function openUnitPanel(unit: UnitWithStatus): void {
    setShowVacateConfirm(false);
    setShowInactiveConfirm(false);
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

  // ONLY modify selected tiers
  const updatedTiers = localTiers.map((tier) =>
    targetTierIds.includes(tier.id)
      ? applyGpLfToTierDraft(tier)
      : tier
  );

  try {
    setSavingGpLf(true);
    setGpLfSaveMessage("");

    const res = await fetch(`/api/admin/properties/${data.property.id}/gplf`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    tiers: updatedTiers
      .filter((tier) => targetTierIds.includes(tier.id))
      .map((tier) => ({
        id: tier.id,
        dueDay: tier.dueDay,
        graceDays: tier.graceDays,
        lateFeeEnabled: tier.lateFeeEnabled,
        lateFeeAmount: tier.lateFeeAmount,
        lateFeeDaily: tier.lateFeeDaily,
        lateFeeMaxDays: tier.lateFeeMaxDays,
      })),
  }),
});

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      setGpLfSaveMessage(json?.error || "Failed to save GP/LF settings.");
      return;
    }

    // merge back into local state safely
    setLocalTiers(updatedTiers);
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
    setShowInactiveConfirm(false);
    setVacateError("");
    setSelectedUnit(null);
    setManualPaymentAmount("");
    setShowManualPaymentConfirm(false);
  }

  function openPanel(panel: Exclude<PanelKey, null>): void {
  setActivePanel(panel);

  if (panel === "gplf") {
    setGpLfTierMode("selected");
    setGpLfSelectedTierIds([]);
    setGpLfSettings(getGpLfSettingsFromTiers(localTiers));
    setGpLfSaveMessage("");
  }
}

  function closePanel(): void {
  setActivePanel(null);

  setMaintenanceError("");
  setMaintenanceActionError("");
  setMaintenancePin("");
  setMaintenancePinConfirm("");
  setMaintenancePinError("");
  setMaintenancePinSuccess("");

  setShowChangeLogin(false);
  setChangeCurrentLogin("");
  setChangeCurrentPassword("");
  setChangeNewEmail("");
  setChangeNewPassword("");
  setChangeConfirmPassword("");

  setShowInactiveUnits(false);
  setInactiveUnits([]);
  setInactiveUnitsError("");
  setInactiveActionUnitId("");
  setConfirmReactivateUnitId("");
  setConfirmDeleteUnitId("");
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

                  {isOwner ? (
  <button
    type="button"
    onClick={() => openPanel("bank")}
    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
  >
    Accnt
  </button>
) : null}

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
                    type="button"
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
  <div className="text-lg font-semibold text-slate-950">
    Current Cycle Snapshot
  </div>

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

  {canVacateUnit ? (
    !showInactiveConfirm ? (
      <button
        type="button"
        onClick={() => setShowInactiveConfirm(true)}
        className="mt-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white"
      >
        {selectedUnit.isActive ? "Set Inactive" : "Reactivate"}
      </button>
    ) : (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-950">
          Are you sure you want to make this unit inactive?
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
          It will not be available for other tenants/customers to use.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submitToggleUnitActive}
            disabled={togglingUnitActive}
            className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {togglingUnitActive ? "Updating..." : "Confirm"}
          </button>

          <button
            type="button"
            onClick={() => setShowInactiveConfirm(false)}
            disabled={togglingUnitActive}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  ) : (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
      View only. Only owner and manager can change active status.
    </div>
  )}
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
  <OverlayShell
    title="Payout Account"
    subtitle="Secure Stripe onboarding for owner payouts and ACH settlement."
    onClose={closePanel}
    showFooter={false}
  >
    <div className="space-y-6 pb-4">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                Stripe Connect
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">
                {bankStatus === "CONNECTED"
  ? "Account connected"
  : bankStatus === "PENDING"
  ? "Verification in progress"
  : bankStatus === "RESTRICTED"
  ? "Action required"
  : "Connect your payout account"}
              </div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {bankMessage ||
  "Connect your payout account to begin receiving tenant ACH settlements through Stripe."}
              </div>
            </div>

            <div
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                bankConnected
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                  : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30"
              }`}
            >
              {bankConnected ? "Connected" : "Not connected"}
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Security
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-950">
              Bank details stay with Stripe
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              RentFray does not manually store routing or account numbers in this flow.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Payouts
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-950">
              Direct owner settlement
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Stripe Connect routes incoming tenant payments to the property’s connected payout account.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Setup
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-950">
              One guided onboarding flow
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Complete verification, banking, and payout details in Stripe’s secure hosted flow.
            </div>
          </div>
        </div>
      </div>

      {!isOwner ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Only the property owner can connect or update the payout account.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          {bankConnected
            ? "Need to change banks or refresh verification? Launch Stripe onboarding again."
            : "Connect the payout account to begin receiving tenant ACH settlements through Stripe."}
        </div>

        <button
          type="button"
          onClick={connectBank}
          disabled={!isOwner}
          className="inline-flex min-w-[220px] items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {bankConnected ? "Manage Payout Account" : "Connect Payout Account"}
        </button>
      </div>
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
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <input
                  type="checkbox"
                  checked={gpLfSelectedTierIds.includes(tier.id)}
                  onChange={() => toggleGpLfTierSelection(tier.id)}
                  disabled={!canEditLateFeeSettings}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>{tier.tierName}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Current Tier Rules
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Review differences before applying new GP&amp;LF settings.
            </div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {gpLfVisibleTiers.length} tier{gpLfVisibleTiers.length === 1 ? "" : "s"} shown
          </div>
        </div>

        {gpLfVisibleTiers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
            No tiers selected yet.
          </div>
        ) : (
          <>
            {gpLfComparisonSummary ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due Day</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{gpLfComparisonSummary.dueDay}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Grace Days</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{gpLfComparisonSummary.graceDays}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Late Fees</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{gpLfComparisonSummary.lateFeeStatus}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Initial Late Fee</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {gpLfComparisonSummary.lateFeeInitial === "Mixed"
                      ? "Mixed"
                      : formatGpLfMoney(gpLfComparisonSummary.lateFeeInitial)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Daily Late Fee</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {gpLfComparisonSummary.lateFeeDaily === "Mixed"
                      ? "Mixed"
                      : formatGpLfMoney(gpLfComparisonSummary.lateFeeDaily)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Max Late Fee Days</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{gpLfComparisonSummary.lateFeeMaxDays}</div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {gpLfVisibleTiers.map((tier) => (
                <div
                  key={tier.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {tier.tierName}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Due Day</div>
                      <div className="mt-1 font-semibold text-slate-900">{tier.dueDay}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Grace Days</div>
                      <div className="mt-1 font-semibold text-slate-900">{tier.graceDays}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Initial Fee</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatGpLfMoney(tier.lateFeeInitial)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Daily Fee</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatGpLfMoney(tier.lateFeeDaily)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Max Days</div>
                      <div className="mt-1 font-semibold text-slate-900">{tier.lateFeeMaxDays}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Late Fees</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {tier.lateFeeEnabled ? "Enabled" : "Disabled"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Due Day</div>
          <input
            type="number"
            min="1"
            max="31"
            value={gpLfSettings.dueDay}
            onChange={(e) => updateGpLf({ dueDay: e.target.value })}
            disabled={!canEditLateFeeSettings}
            className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
          />
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Grace Days</div>
          <input
            type="number"
            min="0"
            value={gpLfSettings.graceDays}
            onChange={(e) => updateGpLf({ graceDays: e.target.value })}
            disabled={!canEditLateFeeSettings}
            className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Disable Late Fee Rules
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Late fees stay active unless you explicitly turn them off.
            </div>
          </div>

          <input
            type="checkbox"
            checked={!gpLfSettings.lateFeeEnabled}
            onChange={(e) =>
              updateGpLf({ lateFeeEnabled: !e.target.checked })
            }
            disabled={!canEditLateFeeSettings}
            className="h-5 w-5 rounded border-slate-300"
          />
        </label>
      </div>

      {gpLfSettings.lateFeeEnabled ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Initial Late Fee
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gpLfSettings.lateFeeInitial}
              onChange={(e) =>
                updateGpLf({ lateFeeInitial: e.target.value })
              }
              disabled={!canEditLateFeeSettings}
              placeholder="0"
              className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
            />
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Daily Late Fee
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gpLfSettings.lateFeeDaily}
              onChange={(e) =>
                updateGpLf({ lateFeeDaily: e.target.value })
              }
              disabled={!canEditLateFeeSettings}
              placeholder="0"
              className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
            />
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Max Late Fee Days
            </div>
            <input
              type="number"
              min="0"
              value={gpLfSettings.lateFeeMaxDays}
              onChange={(e) =>
                updateGpLf({ lateFeeMaxDays: e.target.value })
              }
              disabled={!canEditLateFeeSettings}
              placeholder="0"
              className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:bg-slate-100"
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={saveGpLfSettings}
        disabled={!canEditLateFeeSettings || savingGpLf}
        className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 active:translate-y-px active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {savingGpLf ? "Saving..." : "Save Changes"}
      </button>

      {gpLfSaveMessage ? (
        <div className="text-sm text-slate-600">
          {gpLfSaveMessage}
        </div>
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
    
      {!canManageManagers ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          View only. Only the owner can manage manager accounts and roles.
        </div>
      ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm font-semibold text-slate-800">
          Total Units: {pendingUnitCount ?? activeUnitCount}
        </div>

        {(sessionRole === "OWNER" || sessionRole === "MANAGER") && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (pendingUnitCount == null) return;
                const next = pendingUnitCount - 1;
                if (next < activeUnitCount) return;
                setPendingUnitCount(next);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              -
            </button>

            <button
              type="button"
              onClick={() => {
                if (pendingUnitCount == null) return;
                setPendingUnitCount(pendingUnitCount + 1);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              +
            </button>

            <button
              type="button"
              onClick={() => {
                if (pendingUnitCount == null) return;
                void updateUnitCount(pendingUnitCount);
              }}
              disabled={
                updatingUnitCount ||
                pendingUnitCount == null ||
                pendingUnitCount === activeUnitCount
              }
              className="rounded-lg bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-60"
            >
              {updatingUnitCount ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

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
                <div className="text-xs text-slate-600">{user.role}</div>
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
                        role:
                          user.role === "MANAGER"
                            ? "STAFF"
                            : "MANAGER",
                      })
                    }
                    className="rounded border px-2 py-1 text-xs"
                  >
                    {user.role === "MANAGER"
                      ? "Make Staff"
                      : "Make Manager"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 border-t pt-6">
        {(sessionRole === "OWNER" || sessionRole === "MANAGER") ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowInactiveUnits((prev) => !prev)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              {showInactiveUnits ? "Hide Inactive Units" : "Inactive Units"}
            </button>

            {showInactiveUnits ? (
              <div className="mt-4 space-y-3">
                {inactiveUnitsLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Loading inactive units...
                  </div>
                ) : inactiveUnitsError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {inactiveUnitsError}
                  </div>
                ) : inactiveUnits.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    No inactive units found.
                  </div>
                ) : (
                  inactiveUnits.map((unit) => {
                    const confirmingReactivate = confirmReactivateUnitId === unit.id;
                    const confirmingDelete = confirmDeleteUnitId === unit.id;
                    const isBusy = inactiveActionUnitId === unit.id;

                    return (
                      <div
                        key={unit.id}
                        className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm text-slate-700">
                            <span className="font-semibold text-slate-950">
                              Unit {unit.unitNumber}
                            </span>{" "}
                            • {unit.tierName} • Last active{" "}
                            {formatDate(unit.lastActiveAt)}
                          </div>

                          {!confirmingReactivate && !confirmingDelete ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteUnitId("");
                                  setConfirmReactivateUnitId(unit.id);
                                }}
                                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                              >
                                Reactivate
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmReactivateUnitId("");
                                  setConfirmDeleteUnitId(unit.id);
                                }}
                                className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {confirmingReactivate ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-950">
                              Reactivate Unit {unit.unitNumber}?
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              This unit will become available for use again.
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void reactivateInactiveUnit(unit.id)}
                                disabled={isBusy}
                                className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {isBusy ? "Updating..." : "Confirm"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setConfirmReactivateUnitId("")}
                                disabled={isBusy}
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {confirmingDelete ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-950">
                              Delete Unit {unit.unitNumber}?
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              This permanently removes the inactive unit from this
                              property account.
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void deleteInactiveUnit(unit.id)}
                                disabled={isBusy}
                                className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {isBusy ? "Deleting..." : "Confirm"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUnitId("")}
                                disabled={isBusy}
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setShowChangeLogin((prev) => !prev)}
          className="mt-4 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          {showChangeLogin ? "Cancel Change Login" : "Change Login"}
        </button>

                {showChangeLogin ? (
          <div className="mt-4 space-y-3">
            <input
              placeholder="Current Login"
              value={changeCurrentLogin}
              onChange={(e) => setChangeCurrentLogin(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              type="password"
              placeholder="Current Password"
              value={changeCurrentPassword}
              onChange={(e) => setChangeCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              placeholder="New Email"
              value={changeNewEmail}
              onChange={(e) => setChangeNewEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              type="password"
              placeholder="New Password"
              value={changeNewPassword}
              onChange={(e) => setChangeNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              type="password"
              placeholder="Confirm New Password"
              value={changeConfirmPassword}
              onChange={(e) => setChangeConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <button
              type="button"
              onClick={submitChangeLogin}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Update Login
            </button>
          </div>
        ) : null}
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
        <div className="text-sm font-semibold text-slate-900">
          Status Legend
        </div>

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
            const isComplete = request.status.toUpperCase() === "COMPLETE";
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
                          void runMaintenanceAction(request.id, "IN_PROGRESS")
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
                          void runMaintenanceAction(request.id, "COMPLETE")
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