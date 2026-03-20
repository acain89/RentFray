// app/manager/properties/[id]/tenants/remove/page.tsx

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function parseMoveOutDate(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return new Date();

  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();

  return parsed;
}

async function removeTenantAssignment(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session || !["OWNER", "MANAGER", "STAFF"].includes(session.role)) {
    redirect("/");
  }

  const propertyId = clean(formData.get("propertyId"));
  const unitId = clean(formData.get("unitId"));
  const moveOut = clean(formData.get("moveOut"));
  const reason = clean(formData.get("reason"));

  if (!propertyId) {
    redirect("/manager/properties");
  }

  if (session.propertyId !== propertyId) {
    redirect("/manager/dashboard");
  }

  if (!unitId) {
    redirect(
      `/manager/properties/${propertyId}/tenants/remove?error=Missing unit selection`
    );
  }

  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      propertyId,
    },
    include: {
      assignments: {
        where: { moveOut: null },
        orderBy: { moveIn: "desc" },
        take: 1,
      },
    },
  });

  if (!unit) {
    redirect(
      `/manager/properties/${propertyId}/tenants/remove?error=Unit not found`
    );
  }

  const activeAssignment = unit.assignments[0];

  if (!activeAssignment) {
    redirect(
      `/manager/properties/${propertyId}/tenants/remove?error=No active tenant found for that unit`
    );
  }

  const moveOutDate = parseMoveOutDate(moveOut);

  await prisma.$transaction(async (tx) => {
    await tx.tenantAssignment.update({
      where: { id: activeAssignment.id },
      data: {
        moveOut: moveOutDate,
      },
    });

    await tx.unit.update({
      where: { id: unitId },
      data: {
        portalActivated: false,
        tenantPinHash: null,
        tenantName: null,
      },
    });

    await tx.auditLog.create({
      data: {
        propertyId,
        actorRole: session.role,
        actorLabel: session.managementUserId || "management",
        action: "TENANT_REMOVED",
        entityType: "UNIT",
        entityId: unitId,
        notes: JSON.stringify({
          unitNumber: unit.unitNumber,
          moveOut: moveOut || null,
          reason: reason || null,
        }),
      },
    });
  });

  redirect(`/manager/properties/${propertyId}?removed=1`);
}

export default async function RemoveTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await getSession();

  if (!session || !["OWNER", "MANAGER", "STAFF"].includes(session.role)) {
    redirect("/");
  }

  const { id } = await params;
  const qp = searchParams ? await searchParams : {};
  const error = qp?.error ? decodeURIComponent(qp.error) : "";

  if (session.propertyId !== id) {
    redirect("/manager/dashboard");
  }

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      units: {
        orderBy: { unitNumber: "asc" },
        include: {
          assignments: {
            where: { moveOut: null },
            orderBy: { moveIn: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }

  const occupiedUnits = property.units.filter(
    (unit: { assignments: { id: string }[] }) => unit.assignments.length > 0
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Remove Tenant</h1>
        <p className="text-sm text-neutral-600 mt-1">
          {property.name} ({property.code})
        </p>
      </div>

      {occupiedUnits.length === 0 ? (
        <div className="border rounded-xl p-4 bg-white text-sm text-neutral-700">
          No occupied units found.
        </div>
      ) : null}

      {error ? (
        <div className="border rounded-xl p-4 bg-white text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {occupiedUnits.length > 0 ? (
        <form
          action={removeTenantAssignment}
          className="border rounded-xl p-4 bg-white space-y-4"
        >
          <input type="hidden" name="propertyId" value={property.id} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <div className="text-sm font-medium">Occupied Unit</div>
              <select
                name="unitId"
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                {occupiedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber} — {unit.tenantName || "Active Tenant"}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-sm font-medium">Move-Out Date</div>
              <input
                type="date"
                name="moveOut"
                className="w-full border rounded-lg px-3 py-2"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <div className="text-sm font-medium">Reason</div>
            <textarea
              name="reason"
              className="w-full border rounded-lg px-3 py-2 min-h-[110px]"
              placeholder="Optional removal note"
            />
          </label>

          <div className="border rounded-xl p-4 bg-neutral-50 text-sm text-neutral-700">
            This will:
            <div>• set move-out on the active assignment</div>
            <div>• clear tenant name</div>
            <div>• disable portal access</div>
            <div>• clear the tenant PIN</div>
            <div>• make the unit available again</div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-black text-white"
          >
            Remove Tenant
          </button>
        </form>
      ) : null}
    </div>
  );
}