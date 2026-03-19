import { prisma } from "@/lib/prisma";
import {
  getPropertySettings,
  upsertPropertySettings,
} from "@/lib/propertySettings";

export const dynamic = "force-dynamic";

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampFloat(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function saveSettings(formData: FormData) {
  "use server";

  const propertyId = String(formData.get("propertyId") || "").trim();
  if (!propertyId) {
    throw new Error("Missing propertyId");
  }

  const billingDay = clampInt(formData.get("billingDay"), 1, 1, 31);
  const gracePeriodDays = clampInt(formData.get("gracePeriodDays"), 5, 0, 31);

  const rawLateFeeType = String(
    formData.get("lateFeeType") || "FLAT"
  ).toUpperCase();
  const lateFeeType = rawLateFeeType === "PERCENT" ? "PERCENT" : "FLAT";

  const lateFeeValue =
    lateFeeType === "PERCENT"
      ? clampFloat(formData.get("lateFeeValue"), 5, 0, 100)
      : clampFloat(formData.get("lateFeeValue"), 50, 0, 100000);

  const lifecycleStatus = String(
    formData.get("lifecycleStatus") || "PREVIEW"
  ).toUpperCase();

  await upsertPropertySettings(propertyId, {
    billingDay,
    gracePeriodDays,
    lateFeeType,
    lateFeeValue,
  });

  // --- NEW: lifecycle update ---
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      lifecycleStatus,
    },
  });
}

export default async function PropertySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
  });

  if (!property) {
    return <div className="p-6">Property not found</div>;
  }

  const settings = await getPropertySettings(property.id);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Property Settings</h1>
        <div className="text-sm text-gray-600">{property.name}</div>
      </div>

      <form
        action={saveSettings}
        className="max-w-2xl space-y-4 rounded border p-4"
      >
        <input type="hidden" name="propertyId" value={property.id} />

        {/* --- LIFECYCLE STATUS (NEW CORE BLOCK) --- */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Lifecycle Status</label>
          <select
            name="lifecycleStatus"
            defaultValue={property.lifecycleStatus || "PREVIEW"}
            className="w-full rounded border px-3 py-2"
          >
            <option value="PREVIEW">PREVIEW</option>
            <option value="READY">READY</option>
            <option value="BANKING">BANKING</option>
            <option value="LIVE">LIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>

          <div className="text-xs text-gray-500">
            Controls payment availability and platform behavior.
          </div>
        </div>

        {/* --- BILLING --- */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Billing Day</label>
          <input
            name="billingDay"
            type="number"
            min={1}
            max={31}
            defaultValue={settings.billingDay}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            Grace Period Days
          </label>
          <input
            name="gracePeriodDays"
            type="number"
            min={0}
            max={31}
            defaultValue={settings.gracePeriodDays}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        {/* --- LATE FEES --- */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Late Fee Type</label>
          <select
            name="lateFeeType"
            defaultValue={settings.lateFeeType}
            className="w-full rounded border px-3 py-2"
          >
            <option value="FLAT">FLAT</option>
            <option value="PERCENT">PERCENT</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Late Fee Value</label>
          <input
            name="lateFeeValue"
            type="number"
            step="0.01"
            min={0}
            defaultValue={settings.lateFeeValue}
            className="w-full rounded border px-3 py-2"
          />
          <div className="text-xs text-gray-500">
            Use dollars for FLAT. Use whole percent for PERCENT.
          </div>
        </div>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Save Settings
        </button>
      </form>
    </div>
  );
}