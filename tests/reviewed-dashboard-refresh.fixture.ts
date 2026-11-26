import assert from "node:assert/strict";
// Reviewed read-refresh coordination and hook dependencies only. Unused, uncalled local helpers and state bindings are also removed. Financial writers
// remain outside these exact spans. The unchanged remainder is still byte-compared.
const deltas = [
  {
    "before": "\"use client\";\n\nimport { gracePeriodError, GRACE_PERIOD_MESSAGE } from \"@/lib/gracePeriod\";\n\nimport { getBusinessDate } from \"@/lib/rentDates\";\n\nimport { useEffect, useMemo, useRef, useState, type ReactNode } from \"react\";\nimport { useSearchParams } from \"next/navigation\";\nimport BankPanel from \"./components/BankPanel\";\nimport ManagerPanel from \"./components/ManagerPanel\";\n",
    "after": "\"use client\";\n\nimport { RefreshCoordinator } from \"@/lib/clientRequests\";\n\nimport { gracePeriodError, GRACE_PERIOD_MESSAGE } from \"@/lib/gracePeriod\";\n\nimport { getBusinessDate } from \"@/lib/rentDates\";\n\nimport { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from \"react\";\nimport { useSearchParams } from \"next/navigation\";\nimport BankPanel from \"./components/BankPanel\";\nimport ManagerPanel from \"./components/ManagerPanel\";\n"
  },
  {
    "before": "\ntype ManagerRole = \"MANAGER\" | \"STAFF\";\n\ntype ManagerUser = {\n  id: string;\n  username: string;\n  role: string;\n  isActive: boolean;\n  lastLoginAt?: string | null;\n};\n\ntype ManagersListResponse = {\n  ok?: boolean;\n  error?: string;\n  users?: ManagerUser[];\n};\n\ntype ManagerMutationResponse = {\n  ok?: boolean;\n",
    "after": "\ntype ManagerRole = \"MANAGER\" | \"STAFF\";\n\n\n\n\n\ntype ManagerMutationResponse = {\n  ok?: boolean;\n"
  },
  {
    "before": "  return `${month}/${day}/${year}`;\n}\n\nfunction slugifyTierName(value: string): string {\n  return String(value)\n    .trim()\n    .toLowerCase()\n    .replace(/[^a-z0-9]+/g, \"-\")\n    .replace(/^-+|-+$/g, \"\");\n}\n\nfunction createTierDraft(tierName: string, index = 0): RentTierDraft {\n  const safeName = String(tierName || `Tier ${index + 1}`).trim();\n",
    "after": "  return `${month}/${day}/${year}`;\n}\n\n\n\nfunction createTierDraft(tierName: string, index = 0): RentTierDraft {\n  const safeName = String(tierName || `Tier ${index + 1}`).trim();\n"
  },
  {
    "before": "  };\n}\n\nfunction urgencyBadgeClass(urgency: string): string {\n  switch (urgency.toUpperCase()) {\n    case \"URGENT\":\n      return \"border-red-200 bg-red-50 text-red-700\";\n    case \"HIGH\":\n      return \"border-amber-200 bg-amber-50 text-amber-700\";\n    case \"LOW\":\n      return \"border-slate-200 bg-slate-100 text-slate-600\";\n    case \"NORMAL\":\n    default:\n      return \"border-blue-200 bg-blue-50 text-blue-700\";\n  }\n}\n\nfunction statusBadgeClass(status: string): string {\n  switch (status.toUpperCase()) {\n    case \"COMPLETE\":\n      return \"border-emerald-200 bg-emerald-50 text-emerald-700\";\n    case \"IN_PROGRESS\":\n      return \"border-violet-200 bg-violet-50 text-violet-700\";\n    case \"THIRD_PARTY\":\n      return \"border-orange-200 bg-orange-50 text-orange-700\";\n    case \"OPEN\":\n    default:\n      return \"border-slate-200 bg-slate-100 text-slate-700\";\n  }\n}\n\nfunction OverlayShell({\n  title,\n",
    "after": "  };\n}\n\n\n\n\n\nfunction OverlayShell({\n  title,\n"
  },
  {
    "before": "  );\n}\n\nfunction getMonthRange() {\n  const now = new Date();\n  const start = new Date(now.getFullYear(), now.getMonth(), 1);\n  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);\n  return { start, next };\n}\n\ntype ManageSectionItem = {\n  label: string;\n",
    "after": "  );\n}\n\n\n\ntype ManageSectionItem = {\n  label: string;\n"
  },
  {
    "before": "  const [vacatingUnit, setVacatingUnit] = useState(false);\n  const [showVacateConfirm, setShowVacateConfirm] = useState(false);\n  const [vacateTarget, setVacateTarget] = useState<{ unitId: string; tenantAssignmentId: string } | null>(null);\n  const [showInactiveConfirm, setShowInactiveConfirm] = useState(false);\n  const [togglingUnitActive, setTogglingUnitActive] = useState(false);\n  const [showMoveTierModal, setShowMoveTierModal] = useState(false);\n  const [targetMoveTierId, setTargetMoveTierId] = useState(\"\");\n",
    "after": "  const [vacatingUnit, setVacatingUnit] = useState(false);\n  const [showVacateConfirm, setShowVacateConfirm] = useState(false);\n  const [vacateTarget, setVacateTarget] = useState<{ unitId: string; tenantAssignmentId: string } | null>(null);\n  const [, setShowInactiveConfirm] = useState(false);\n  const [togglingUnitActive, setTogglingUnitActive] = useState(false);\n  const [showMoveTierModal, setShowMoveTierModal] = useState(false);\n  const [targetMoveTierId, setTargetMoveTierId] = useState(\"\");\n"
  },
  {
    "before": "  const [chargesLoading, setChargesLoading] = useState(false);\n  const [chargesError, setChargesError] = useState(\"\");\n  const [savingCharges, setSavingCharges] = useState(false);\n  const [chargesEffectiveMonth, setChargesEffectiveMonth] = useState(\"\");\n  const viewMode: \"full\" = \"full\";\n  const [exportSelectedUnit, setExportSelectedUnit] = useState(\"\");\n  const [exportUnitError, setExportUnitError] = useState(\"\");\n  const [showChangeLogin, setShowChangeLogin] = useState(false);\n  const [changeCurrentLogin, setChangeCurrentLogin] = useState(\"\");\n  const [changeCurrentPassword, setChangeCurrentPassword] = useState(\"\");\n",
    "after": "  const [chargesLoading, setChargesLoading] = useState(false);\n  const [chargesError, setChargesError] = useState(\"\");\n  const [savingCharges, setSavingCharges] = useState(false);\n  const [, setChargesEffectiveMonth] = useState(\"\");\n\n  const [exportSelectedUnit, setExportSelectedUnit] = useState(\"\");\n  const [, ] = useState(\"\");\n  const [showChangeLogin, setShowChangeLogin] = useState(false);\n  const [changeCurrentLogin, setChangeCurrentLogin] = useState(\"\");\n  const [changeCurrentPassword, setChangeCurrentPassword] = useState(\"\");\n"
  },
  {
    "before": "  const [inactiveActionUnitId, setInactiveActionUnitId] = useState(\"\");\n  const [confirmReactivateUnitId, setConfirmReactivateUnitId] = useState(\"\");\n  const [confirmDeleteUnitId, setConfirmDeleteUnitId] = useState(\"\");\n  const [loadingDashboard, setLoadingDashboard] = useState(false);\n  const [rentFrayStartDate, setRentFrayStartDate] = useState(\"\");\n  const [rentFrayStartDateLocked, setRentFrayStartDateLocked] = useState(false);\n  const [savingRentFrayStartDate, setSavingRentFrayStartDate] = useState(false);\n",
    "after": "  const [inactiveActionUnitId, setInactiveActionUnitId] = useState(\"\");\n  const [confirmReactivateUnitId, setConfirmReactivateUnitId] = useState(\"\");\n  const [confirmDeleteUnitId, setConfirmDeleteUnitId] = useState(\"\");\n  const dashboardRefresh = useRef(new RefreshCoordinator());\n  const [rentFrayStartDate, setRentFrayStartDate] = useState(\"\");\n  const [rentFrayStartDateLocked, setRentFrayStartDateLocked] = useState(false);\n  const [savingRentFrayStartDate, setSavingRentFrayStartDate] = useState(false);\n"
  },
  {
    "before": "  }\n\n  setLocalTiers(\n    data.tiers.map((tier, index) => ({\n      id: tier.id,\n      tierName: tier.name,\n      unitCount: String(tier.configuredUnitCount ?? tier.unitCount ?? 0),\n",
    "after": "  }\n\n  setLocalTiers(\n    data.tiers.map((tier) => ({\n      id: tier.id,\n      tierName: tier.name,\n      unitCount: String(tier.configuredUnitCount ?? tier.unitCount ?? 0),\n"
  },
  {
    "before": "  setConfiguredGpLfTierIds(activeTiers.map((tier) => tier.id));\n}\n\nfunction getGpLfSettingsFromTiers(tiers: RentTierDraft[]) {\n  const source =\n    tiers.find(\n      (tier) =>\n",
    "after": "  setConfiguredGpLfTierIds(activeTiers.map((tier) => tier.id));\n}\n\nconst getGpLfSettingsFromTiers = useCallback((tiers: RentTierDraft[]) => {\n  const source =\n    tiers.find(\n      (tier) =>\n"
  },
  {
    "before": "    lateFeeDaily: source.lateFeeDaily || \"\",\n    lateFeeMaxDays: source.lateFeeMaxDays || \"\",\n  };\n}\n\n  type GpLfTierSnapshot = {\n  id: string;\n  tierName: string;\n  graceDays: string;\n  lateFeeEnabled: boolean;\n  lateFeeInitial: string;\n  lateFeeDaily: string;\n  lateFeeMaxDays: string;\n};\n\nfunction formatGpLfMoney(value: string): string {\n  const amount = Number(value);\n  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : \"$0.00\";\n}\n\nfunction getGpLfTierSnapshot(tier: RentTierDraft): GpLfTierSnapshot {\n  return {\n    id: tier.id,\n    tierName: tier.tierName,\n    graceDays: tier.graceDays || \"0\",\n    lateFeeEnabled: Boolean(tier.lateFeeEnabled),\n    lateFeeInitial: tier.lateFeeAmount || \"0\",\n    lateFeeDaily: tier.lateFeeDaily || \"0\",\n    lateFeeMaxDays: tier.lateFeeMaxDays || \"0\",\n  };\n}\n\nfunction getMixedText(values: string[]): string {\n  const unique = Array.from(new Set(values.map((value) => String(value).trim())));\n  return unique.length <= 1 ? (unique[0] || \"\u2014\") : \"Mixed\";\n}\n\nfunction getMixedBooleanText(values: boolean[]): string {\n  const unique = Array.from(new Set(values));\n  return unique.length <= 1 ? (unique[0] ? \"Enabled\" : \"Disabled\") : \"Mixed\";\n}\n\n  const managers = data?.property?.managementUsers ?? [];\n  const [managersLoading, setManagersLoading] = useState(false);\n  const [managersError, setManagersError] = useState(\"\");\n\n  const [newEmail, setNewEmail] = useState(\"\");\n  const [newPassword, setNewPassword] = useState(\"\");\n",
    "after": "    lateFeeDaily: source.lateFeeDaily || \"\",\n    lateFeeMaxDays: source.lateFeeMaxDays || \"\",\n  };\n}, [data?.property?.onboarding?.billingComplete]);\n\n\n\n\n\n\n\n\n\n\n\n  const managers = data?.property?.managementUsers ?? [];\n  const [managersLoading, ] = useState(false);\n  const [managersError, ] = useState(\"\");\n\n  const [newEmail, setNewEmail] = useState(\"\");\n  const [newPassword, setNewPassword] = useState(\"\");\n"
  },
  {
    "before": "  const canManageManagers = sessionRole === \"OWNER\" || sessionRole === \"MANAGER\";\n  const isOwner = sessionRole === \"OWNER\";\n  const propertyName = data?.property?.name ?? \"Manager Dashboard\";\n  const [pendingUnitCount, setPendingUnitCount] = useState<number | null>(null);\n  const [updatingUnitCount, setUpdatingUnitCount] = useState(false);\n  const propertyCode = data?.property?.code ?? \"----\";\n  const bankStatus = data?.property?.paymentStatus?.bankStatus;\n  const bankMessage = data?.property?.paymentStatus?.bankMessage;\n\n  const activeUnitCount = useMemo(() => {\n  return Array.isArray(data?.units)\n    ? data.units.filter((unit) => unit.isActive).length\n    : 0;\n}, [data?.units]);\n\n const [exportMonth, setExportMonth] = useState(\"\");\n\nconst [exportType, setExportType] = useState<\"balances\" | \"ledger\" | \"payments\">(\"balances\");\nconst [exportUnitSearch, setExportUnitSearch] = useState(\"\");\nconst [exporting, setExporting] = useState(false);\n\nasync function updateUnitCount(next: number): Promise<void> {\n  if (data?.property?.unitCount == null) return;\n  if (updatingUnitCount) return;\n\n  const confirmed = window.confirm(\n    `Update total units to ${next}?`\n  );\n\n  if (!confirmed) return;\n\n  try {\n    setUpdatingUnitCount(true);\n\n    const res = await fetch(\"/api/manager/property/unit-count\", {\n      method: \"PATCH\",\n      headers: {\n        \"Content-Type\": \"application/json\",\n      },\n      credentials: \"include\",\n      body: JSON.stringify({ unitCount: next }),\n    });\n\n    const json = await res.json().catch(() => null);\n\n    if (!res.ok || !json?.ok) {\n      alert(json?.error || \"Failed to update unit count.\");\n      return;\n    }\n\nawait new Promise((r) => setTimeout(r, 150));\nawait loadDashboard({ silent: true });\n  } catch {\n    alert(\"Failed to update unit count.\");\n  } finally {\n    setUpdatingUnitCount(false);\n  }\n}\n\nasync function connectBank(): Promise<void> {\n  try {\n",
    "after": "  const canManageManagers = sessionRole === \"OWNER\" || sessionRole === \"MANAGER\";\n  const isOwner = sessionRole === \"OWNER\";\n  const propertyName = data?.property?.name ?? \"Manager Dashboard\";\n  const [, setPendingUnitCount] = useState<number | null>(null);\n  const [, ] = useState(false);\n  const propertyCode = data?.property?.code ?? \"----\";\n  const bankStatus = data?.property?.paymentStatus?.bankStatus;\n  const bankMessage = data?.property?.paymentStatus?.bankMessage;\n\n\n\n const [exportMonth, setExportMonth] = useState(\"\");\n\nconst [exportType, setExportType] = useState<\"balances\" | \"ledger\" | \"payments\">(\"balances\");\nconst [, ] = useState(\"\");\nconst [exporting, setExporting] = useState(false);\n\n\n\nasync function connectBank(): Promise<void> {\n  try {\n"
  },
  {
    "before": "  }\n}\n\n  async function loadDashboard(\n  options: { silent?: boolean } = {}\n): Promise<void> {\n  if (loadingDashboard) return;\n\n  const silent = options.silent === true;\n\n  try {\n    setLoadingDashboard(true);\n\nif (!silent && !data) {\n  setLoading(true);\n",
    "after": "  }\n}\n\n  async function loadDashboard(options: { silent?: boolean } = {}): Promise<void> {\n  return dashboardRefresh.current.request(async () => {\n\n\n  const silent = options.silent === true;\n\n  try {\n\n\nif (!silent && !data) {\n  setLoading(true);\n"
  },
  {
    "before": "  setLoading(false);\n}\n\nsetLoadingDashboard(false);\n  }\n}\n\n  async function loadMaintenanceRequests(): Promise<void> {\n",
    "after": "  setLoading(false);\n}\n\n\n  }\n\n  });\n}\n\n  async function loadMaintenanceRequests(): Promise<void> {\n"
  },
  {
    "before": "\n  const months: { value: string; label: string }[] = [];\n\n  let cursor = new Date(start);\n\n  while (cursor <= end) {\n    const year = cursor.getFullYear();\n",
    "after": "\n  const months: { value: string; label: string }[] = [];\n\n  const cursor = new Date(start);\n\n  while (cursor <= end) {\n    const year = cursor.getFullYear();\n"
  },
  {
    "before": "  setRentFrayStartDateLocked(Boolean(savedDate));\n}, [data]);\n\nuseEffect(() => {\n  (async () => {\n    await new Promise((r) => setTimeout(r, 150));\nawait loadDashboard();\n  })();\n}, []);\n\nuseEffect(() => {\n",
    "after": "  setRentFrayStartDateLocked(Boolean(savedDate));\n}, [data]);\n\nconst loadInitialDashboard = useEffectEvent(() => { void loadDashboard(); });\nuseEffect(() => {\n  const timer = setTimeout(() => loadInitialDashboard(), 150);\n  return () => clearTimeout(timer);\n}, []);\n\nuseEffect(() => {\n"
  },
  {
    "before": "  activePanel,\n  localTiers,\n  data?.property?.onboarding?.billingComplete,\n]);\n\nuseEffect(() => {\n",
    "after": "  activePanel,\n  localTiers,\n  data?.property?.onboarding?.billingComplete,\n  getGpLfSettingsFromTiers,\n]);\n\nuseEffect(() => {\n"
  },
  {
    "before": "  }\n}, [activePanel]);\n\nuseEffect(() => {\n  if (activePanel === \"charges\" || activePanel === \"rent\") {\n    void loadTierCharges();\n  }\n}, [activePanel, data?.property?.id]);\n\n",
    "after": "  }\n}, [activePanel]);\n\nconst refreshTierCharges = useEffectEvent(() => { void loadTierCharges(); });\nuseEffect(() => {\n  if (activePanel === \"charges\" || activePanel === \"rent\") {\n    refreshTierCharges();\n  }\n}, [activePanel, data?.property?.id]);\n\n"
  },
  {
    "before": "\n\n\n  const sortedMaintenanceRequests = useMemo<MaintenanceRequestRow[]>(() => {\n    return [...maintenanceRequests].sort(\n      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()\n    );\n  }, [maintenanceRequests]);\n\n    const stats = useMemo(() => {\n    const totalUnits = unitsWithStatus.length;\n    const occupiedUnits = unitsWithStatus.filter(u => u.tenantName).length;\n    const vacantUnits = unitsWithStatus.filter(u => !u.tenantName).length;\n    const tiers = tierGroups.length;\n\n    return {\n      totalUnits,\n      occupiedUnits,\n      vacantUnits,\n      tiers,\n    };\n  }, [tierGroups.length, unitsWithStatus]);\n\n  function openUnitPanel(unit: UnitWithStatus): void {\n    setShowVacateConfirm(false);\n",
    "after": "\n\n\n\n\n\n\n  function openUnitPanel(unit: UnitWithStatus): void {\n    setShowVacateConfirm(false);\n"
  },
  {
    "before": "  };\n}\n\nfunction formatMonthLabel(value: string): string {\n  const date = new Date(value);\n\n  if (Number.isNaN(date.getTime())) {\n    return \"next month\";\n  }\n\n  return date.toLocaleDateString(\"en-US\", {\n    month: \"long\",\n    year: \"numeric\",\n  });\n}\n\nfunction addLocalTier(): void {\n  setLocalTiers((current) => {\n",
    "after": "  };\n}\n\n\n\nfunction addLocalTier(): void {\n  setLocalTiers((current) => {\n"
  }
] as const;
export function reviewedDashboardRefresh(source: string): string {
  let result = source;
  for (const delta of deltas) {
    assert.equal(result.split(delta.before).length, 2, "Exactly one reviewed dashboard refresh span");
    result = result.replace(delta.before, delta.after);
  }
  return result;
}
