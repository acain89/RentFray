// app/manager/properties/[id]/pin-reset/page.tsx

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hashPin, isValidFourDigitPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function resetTenantPin(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session || !["OWNER", "MANAGER", "STAFF"].includes(session.role)) {
    redirect("/");
  }

  const propertyId = clean(formData.get("propertyId"));
  const unitId = clean(formData.get("unitId"));
  const pin = clean(formData.get("pin"));

  if (!propertyId) {
    redirect("/manager/properties");
  }

  if (session.propertyId !== propertyId) {
    redirect("/manager/dashboard");
  }

  if (!unitId || !isValidFourDigitPin(pin)) {
    redirect(
      `/manager/properties/${propertyId}/pin-reset?tenantError=PIN must be exactly 4 digits`
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
        take: 1,
      },
    },
  });

  if (!unit) {
    redirect(
      `/manager/properties/${propertyId}/pin-reset?tenantError=Unit not found`
    );
  }

  if (unit.assignments.length === 0) {
    redirect(
      `/manager/properties/${propertyId}/pin-reset?tenantError=Unit does not have an active tenant`
    );
  }

  const tenantPinHash = await hashPin(pin);

  await prisma.$transaction(async (tx) => {
    await tx.unit.update({
      where: { id: unitId },
      data: {
        portalActivated: true,
        tenantPinHash,
      },
    });

    await tx.auditLog.create({
      data: {
        propertyId,
        actorRole: session.role,
        actorLabel: session.managementUserId || "management",
        action: "TENANT_PIN_RESET",
        entityType: "UNIT",
        entityId: unitId,
        notes: JSON.stringify({
          unitNumber: unit.unitNumber,
        }),
      },
    });
  });

  redirect(`/manager/properties/${propertyId}/pin-reset?tenantSuccess=1`);
}

async function saveMaintenancePin(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session || !["OWNER", "MANAGER"].includes(session.role)) {
    redirect("/");
  }

  const propertyId = clean(formData.get("propertyId"));
  const maintenanceUserId = clean(formData.get("maintenanceUserId"));
  const workerName = clean(formData.get("workerName"));
  const pin = clean(formData.get("pin"));

  if (!propertyId) {
    redirect("/manager/properties");
  }

  if (session.propertyId !== propertyId) {
    redirect("/manager/dashboard");
  }

  if (!isValidFourDigitPin(pin)) {
    redirect(
      `/manager/properties/${propertyId}/pin-reset?maintenanceError=PIN must be exactly 4 digits`
    );
  }

  const pinHash = await hashPin(pin);

  if (maintenanceUserId) {
    const worker = await prisma.maintenanceUser.findFirst({
      where: {
        id: maintenanceUserId,
        propertyId,
      },
    });

    if (!worker) {
      redirect(
        `/manager/properties/${propertyId}/pin-reset?maintenanceError=Maintenance worker not found`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.maintenanceUser.update({
        where: { id: maintenanceUserId },
        data: {
          pinHash,
        },
      });

      await tx.auditLog.create({
        data: {
          propertyId,
          actorRole: session.role,
          actorLabel: session.managementUserId || "management",
          action: "MAINTENANCE_PIN_RESET",
          entityType: "MAINTENANCE_USER",
          entityId: maintenanceUserId,
          notes: JSON.stringify({
            workerName: worker.name,
          }),
        },
      });
    });

    redirect(`/manager/properties/${propertyId}/pin-reset?maintenanceSuccess=1`);
  }

  if (!workerName) {
    redirect(
      `/manager/properties/${propertyId}/pin-reset?maintenanceError=Worker name is required when creating a new maintenance login`
    );
  }

  const existingByName = await prisma.maintenanceUser.findFirst({
    where: {
      propertyId,
      name: workerName,
    },
  });

  if (existingByName) {
    redirect(
      `/manager/properties/${propertyId}/pin-reset?maintenanceError=A maintenance worker with that name already exists`
    );
  }

  const created = await prisma.maintenanceUser.create({
    data: {
      propertyId,
      name: workerName,
      pinHash,
    },
  });

  await prisma.auditLog.create({
    data: {
      propertyId,
      actorRole: session.role,
      actorLabel: session.managementUserId || "management",
      action: "MAINTENANCE_USER_CREATED_WITH_PIN",
      entityType: "MAINTENANCE_USER",
      entityId: created.id,
      notes: JSON.stringify({
        workerName,
      }),
    },
  });

  redirect(`/manager/properties/${propertyId}/pin-reset?maintenanceSuccess=1`);
}

export default async function PinResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    tenantError?: string;
    maintenanceError?: string;
    tenantSuccess?: string;
    maintenanceSuccess?: string;
  }>;
}) {
  const session = await getSession();

  if (!session || !["OWNER", "MANAGER", "STAFF"].includes(session.role)) {
    redirect("/");
  }

  const { id } = await params;
  const qp = searchParams ? await searchParams : {};

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
            take: 1,
          },
        },
      },
      maintenanceUsers: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }

  const occupiedUnits = property.units.filter(
    (unit: { assignments: { id: string }[] }) => unit.assignments.length > 0
  );

  const tenantError = qp?.tenantError ? decodeURIComponent(qp.tenantError) : "";
  const maintenanceError = qp?.maintenanceError
    ? decodeURIComponent(qp.maintenanceError)
    : "";
  const tenantSuccess = qp?.tenantSuccess === "1";
  const maintenanceSuccess = qp?.maintenanceSuccess === "1";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">PIN Reset</h1>
        <p className="text-sm text-neutral-600 mt-1">
          {property.name} ({property.code})
        </p>
      </div>

      <div className="border rounded-xl p-4 bg-white space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tenant PIN Reset</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Available to owner, manager, and staff.
          </p>
        </div>

        {tenantError ? (
          <div className="text-sm text-red-600">{tenantError}</div>
        ) : null}

        {tenantSuccess ? (
          <div className="text-sm text-green-600">Tenant PIN updated.</div>
        ) : null}

        {occupiedUnits.length === 0 ? (
          <div className="text-sm text-neutral-600">
            No occupied units available for PIN reset.
          </div>
        ) : (
          <form action={resetTenantPin} className="space-y-4">
            <input type="hidden" name="propertyId" value={property.id} />

            <label className="space-y-1 block">
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

            <label className="space-y-1 block">
              <div className="text-sm font-medium">New 4-Digit PIN</div>
              <input
                name="pin"
                inputMode="numeric"
                maxLength={4}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="1234"
                required
              />
            </label>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-black text-white"
            >
              Reset Tenant PIN
            </button>
          </form>
        )}
      </div>

      {["OWNER", "MANAGER"].includes(session.role) ? (
        <div className="border rounded-xl p-4 bg-white space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Maintenance PIN Create / Reset</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Owner and manager only.
            </p>
          </div>

          {maintenanceError ? (
            <div className="text-sm text-red-600">{maintenanceError}</div>
          ) : null}

          {maintenanceSuccess ? (
            <div className="text-sm text-green-600">
              Maintenance PIN saved.
            </div>
          ) : null}

          <form action={saveMaintenancePin} className="space-y-4">
            <input type="hidden" name="propertyId" value={property.id} />

            <label className="space-y-1 block">
              <div className="text-sm font-medium">Existing Worker</div>
              <select
                name="maintenanceUserId"
                className="w-full border rounded-lg px-3 py-2"
                defaultValue=""
              >
                <option value="">Create new worker instead</option>
                {property.maintenanceUsers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <div className="text-sm font-medium">New Worker Name</div>
              <input
                name="workerName"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Only used when creating a new maintenance login"
              />
            </label>

            <label className="space-y-1 block">
              <div className="text-sm font-medium">4-Digit PIN</div>
              <input
                name="pin"
                inputMode="numeric"
                maxLength={4}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="1234"
                required
              />
            </label>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-black text-white"
            >
              Save Maintenance PIN
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}