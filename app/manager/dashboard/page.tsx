"use client";

import { useEffect, useMemo, useState } from "react";

type Unit = {
  unitId: string;
  unitNumber: string;
  tenantName: string | null;
  balance: number;
  isDelinquent: boolean;
  daysPastDue: number;
  tierName?: string | null;
};

type DashboardData = {
  property: {
    name: string;
    code: string;
  };
  session: {
    role: "OWNER" | "MANAGER" | "STAFF";
  };
  units: Unit[];
};

type UnitStatus = "PAID" | "PARTIAL" | "GRACE" | "DELINQUENT" | "VACANT";

type PanelKey = "rent" | "gplf" | "manager" | "info" | "maint" | null;

type UnitWithStatus = Unit & {
  status: UnitStatus;
  displayLastName: string;
};

type TierGroup = {
  tierName: string;
  units: UnitWithStatus[];
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

function getStatus(unit: Unit): UnitStatus {
  if (!unit.tenantName) return "VACANT";
  if (unit.balance <= 0) return "PAID";
  if (unit.isDelinquent) return "DELINQUENT";
  if (unit.daysPastDue > 0) return "GRACE";
  return "PARTIAL";
}

function getStatusDotClass(status: UnitStatus): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-500";
    case "GRACE":
      return "bg-amber-400";
    case "DELINQUENT":
      return "bg-red-500";
    case "VACANT":
      return "bg-slate-400";
    case "PARTIAL":
    default:
      return "bg-emerald-500";
  }
}

function getStatusText(status: UnitStatus, daysPastDue: number): string {
  switch (status) {
    case "PAID":
      return "Current";
    case "GRACE":
      return "Grace period";
    case "DELINQUENT":
      return `${daysPastDue} day${daysPastDue === 1 ? "" : "s"} past due`;
    case "VACANT":
      return "Vacant";
    case "PARTIAL":
    default:
      return "Balance due";
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
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
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

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <button
            type="button"
            disabled
            className="w-full rounded-2xl bg-slate-300 px-4 py-3 text-sm font-semibold text-white sm:w-auto sm:min-w-[180px]"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
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

  const [managers, setManagers] = useState<
  {
    id: string;
    username: string;
    role: string;
    isActive: boolean;
    lastLoginAt?: string | null;
  }[]
>([]);
const [managersLoading, setManagersLoading] = useState(false);
const [managersError, setManagersError] = useState("");

const [newUsername, setNewUsername] = useState("");
const [newPassword, setNewPassword] = useState("");
const [newRole, setNewRole] = useState("STAFF");
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

async function loadManagers(): Promise<void> {
  try {
    setManagersLoading(true);
    setManagersError("");

    const res = await fetch(
      `/api/admin/properties/${data?.property?.code ? "" : ""}${data?.property?.id}/management-users`,
      {
        credentials: "include",
      }
    );

    const json = await res.json();

    if (!res.ok || !json?.ok) {
      setManagersError(json?.error || "Failed to load managers.");
      return;
    }

    setManagers(json.users || []);
  } catch {
    setManagersError("Failed to load managers.");
  } finally {
    setManagersLoading(false);
  }
}

async function createManager(): Promise<void> {
  if (!newUsername || !newPassword) return;

  try {
    setCreatingUser(true);

    const res = await fetch(
      `/api/admin/properties/${data?.property?.id}/management-users`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      }
    );

    const json = await res.json();

    if (!res.ok || !json?.ok) {
      alert(json?.error || "Failed to create user");
      return;
    }

    setNewUsername("");
    setNewPassword("");
    setNewRole("STAFF");

    await loadManagers();
  } finally {
    setCreatingUser(false);
  }
}

async function updateManager(userId: string, updates: any) {
  try {
    const res = await fetch(
      `/api/admin/properties/${data?.property?.id}/management-users`,
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

    const json = await res.json();

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
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (activePanel === "maint") {
      void loadMaintenanceRequests();
    }
  }, [activePanel]);

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

  const sortedMaintenanceRequests = useMemo(() => {
    return [...maintenanceRequests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [maintenanceRequests]);

  const stats = useMemo(() => {
    const totalUnits = unitsWithStatus.length;
    const occupiedUnits = unitsWithStatus.filter(
      (unit) => unit.status !== "VACANT"
    ).length;
    const vacantUnits = unitsWithStatus.filter(
      (unit) => unit.status === "VACANT"
    ).length;
    const tiers = tierGroups.length;

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      tiers,
    };
  }, [tierGroups.length, unitsWithStatus]);

  const sessionRole = data?.session?.role ?? "STAFF";
  const canManageMoney = sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canVacateUnit = sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canManageMaintenance =
    sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canEditRentSettings =
    sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canEditLateFeeSettings =
    sessionRole === "OWNER" || sessionRole === "MANAGER";
  const canManageManagers = sessionRole === "OWNER";
  const propertyName = data?.property?.name ?? "Manager Dashboard";
  const propertyCode = data?.property?.code ?? "----";

  function openUnitPanel(unit: UnitWithStatus): void {
    setShowVacateConfirm(false);
    setVacateError("");
    setSelectedUnit(unit);
    setManualPaymentAmount(
      unit.status === "VACANT" ? "" : Number(unit.balance || 0).toFixed(2)
    );
    setShowManualPaymentConfirm(false);
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
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Total Units
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {stats.totalUnits}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Occupied
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {stats.occupiedUnits}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Vacant
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {stats.vacantUnits}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Tiers
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {stats.tiers}
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
                        const vacant = unit.status === "VACANT";

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
                                  className="shrink-0 rounded-xl px-2 py-1 text-left text-base font-semibold text-slate-950 transition hover:bg-white"
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
        </div>
      </main>

      {selectedUnit ? (
        <OverlayShell
          title={`Unit ${selectedUnit.unitNumber}`}
          subtitle={
            selectedUnit.status === "VACANT"
              ? "Vacant unit"
              : `${selectedUnit.tenantName || "Tenant"} • ${getStatusText(
                  selectedUnit.status,
                  selectedUnit.daysPastDue
                )}`
          }
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
                  {selectedUnit.status === "VACANT"
                    ? "-"
                    : toMoney(selectedUnit.balance)}
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

            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">
                Manual Payment
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Half-screen payment flow is staged here inside the unit panel.
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
                    disabled={selectedUnit.status === "VACANT" || !canManageMoney}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="0.00"
                  />
                </div>

                <button
                  type="button"
                  disabled={
                    selectedUnit.status === "VACANT" ||
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
                  disabled={selectedUnit.status === "VACANT" || !canVacateUnit}
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

      {activePanel === "rent" ? (
        <OverlayShell
          title="Rent Panel"
          subtitle="Tier rent settings and add-tier controls."
          onClose={closePanel}
        >
          <div className="space-y-3">
            {!canEditRentSettings ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                View only. Only owner and manager can change rent settings.
              </div>
            ) : null}

            {tierGroups.map((group) => (
              <div
                key={group.tierName}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-950">
                    {group.tierName}
                  </div>
                  <button
                    type="button"
                    disabled={!canEditRentSettings}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Change
                  </button>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Tier pricing controls are now staged here for the final data
                  hookup.
                </div>
              </div>
            ))}

            <button
              type="button"
              disabled={!canEditRentSettings}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Add Tier
            </button>
          </div>
        </OverlayShell>
      ) : null}

      {activePanel === "gplf" ? (
        <OverlayShell
          title="Grace Period & Late Fee"
          subtitle="Per-tier due day, grace period, and late fee controls."
          onClose={closePanel}
        >
          <div className="space-y-3">
            {!canEditLateFeeSettings ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                View only. Only owner and manager can change grace period and
                late fee settings.
              </div>
            ) : null}

            {tierGroups.map((group) => (
              <div
                key={group.tierName}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-sm font-semibold text-slate-950">
                  {group.tierName}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  This panel is reserved for due day, grace period, late fee
                  toggle, late fee amount, and any final tier rule controls.
                </div>
              </div>
            ))}
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

      {/* CREATE USER */}
      {canManageManagers ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-950">
            Add Manager / Staff
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
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
              onChange={(e) => setNewRole(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              <option value="MANAGER">Manager</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>

          <button
            onClick={createManager}
            disabled={creatingUser}
            className="rounded-xl bg-slate-950 px-4 py-2 text-white text-sm font-semibold"
          >
            {creatingUser ? "Creating..." : "Create"}
          </button>
        </div>
      ) : null}

      {/* LIST */}
      {managersLoading ? (
        <div className="text-sm text-slate-600">Loading...</div>
      ) : managersError ? (
        <div className="text-sm text-red-600">{managersError}</div>
      ) : (
        <div className="space-y-2">
          {managers.map((user) => (
            <div
              key={user.id}
              className="rounded-[20px] border border-slate-200 bg-slate-50 p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-sm">
                  {user.username}
                </div>
                <div className="text-xs text-slate-600">
                  {user.role} • {user.isActive ? "Active" : "Disabled"}
                </div>
              </div>

              {canManageManagers ? (
                <div className="flex gap-2">
                  <select
                    value={user.role}
                    onChange={(e) =>
                      updateManager(user.id, { role: e.target.value })
                    }
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="STAFF">Staff</option>
                  </select>

                  <button
                    onClick={() =>
                      updateManager(user.id, {
                        isActive: !user.isActive,
                      })
                    }
                    className="text-xs px-2 py-1 border rounded"
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

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-950">
                Status Legend
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
                  Occupied / current
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="h-3.5 w-3.5 rounded-full bg-amber-400" />
                  Grace period
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="h-3.5 w-3.5 rounded-full bg-red-500" />
                  Past due
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="h-3.5 w-3.5 rounded-full bg-slate-400" />
                  Vacant
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