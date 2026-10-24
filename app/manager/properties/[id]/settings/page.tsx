import { redirect } from "next/navigation";
import GracePeriodInput from "@/app/components/GracePeriodInput";
import { GracePeriodError, GRACE_PERIOD_MESSAGE } from "@/lib/gracePeriod";
import { prisma } from "@/lib/prisma";
import { requireManagementSession, requireManagerLevelSession } from "@/lib/session";
import {
  getPropertySettings,
  upsertPropertySettings,
} from "@/lib/propertySettings";

export const dynamic = "force-dynamic";

function clampFloat(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function saveSettings(formData: FormData) {
  "use server";

  const session = await requireManagerLevelSession();

  if (!session.propertyId) {
    throw new Error("Unauthorized");
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!propertyId) {
    throw new Error("Missing propertyId");
  }

  if (propertyId !== session.propertyId) {
    throw new Error("Forbidden");
  }

  const gracePeriodDays = formData.has("gracePeriodDays") ? formData.get("gracePeriodDays") : undefined;

  const lateFeeFlatCents = Math.round(
    clampFloat(formData.get("lateFeeValue"), 50, 0, 100000) * 100
  );

  try {
    await upsertPropertySettings(session.propertyId, {
      gracePeriodDays,
      lateFeeFlatCents,
      lateFeeEnabled: lateFeeFlatCents > 0,
    });
  } catch (error) {
    if (error instanceof GracePeriodError) redirect(`/manager/properties/${propertyId}/settings?graceError=1`);
    throw error;
  }
  redirect(`/manager/properties/${propertyId}/settings`);

}

export default async function PropertySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ graceError?: string }>;
}) {
  const session = await requireManagementSession();

  if (!session.propertyId) {
    throw new Error("Unauthorized");
  }

  const { id } = await params;

  if (id !== session.propertyId) {
    throw new Error("Forbidden");
  }

  const graceError = (await searchParams)?.graceError === "1" ? GRACE_PERIOD_MESSAGE : undefined;
  const canEdit = session.role === "OWNER" || session.role === "MANAGER";

  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
    },
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
        action={canEdit ? saveSettings : undefined}
        className="max-w-2xl space-y-4 rounded border p-4"
      >
        <input type="hidden" name="propertyId" value={property.id} />

        <div className="space-y-1">
          <label className="text-sm font-medium">Lifecycle Status</label>
          <div className="w-full rounded border px-3 py-2">
            {property.status || "SETUP"}
          </div>
          <div className="text-xs text-gray-500">
            Lifecycle status is read-only here.
          </div>
        </div>


        <div className="space-y-1">
          <label className="text-sm font-medium">Grace Period Days</label>
          <GracePeriodInput
            savedValue={settings.gracePeriodDays}
            serverError={graceError}
            name="gracePeriodDays"
            disabled={!canEdit}
            defaultValue={settings.gracePeriodDays}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Late Fee Value</label>
          <input
            name="lateFeeValue"
            disabled={!canEdit}
            type="number"
            step="0.01"
            min={0}
            defaultValue={(settings.lateFeeFlatCents ?? 0) / 100}
            className="w-full rounded border px-3 py-2"
          />
          <div className="text-xs text-gray-500">
            Enter a flat dollar amount. Leave at 0 to disable late fees.
          </div>
        </div>

        {canEdit && (
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Save Settings
        </button>
        )}
      </form>
    </div>
  );
}