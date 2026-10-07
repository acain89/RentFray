// app/manager/properties/[id]/pin-reset/page.tsx

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isValidFourDigitPin } from "@/lib/pin";
import { canManageMaintenancePins } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function saveMaintenancePin(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session || !canManageMaintenancePins(session.role)) {
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
      `/manager/properties/${propertyId}/pin-reset?maintenanceError=${encodeURIComponent(
        "PIN must be exactly 4 digits"
      )}`
    );
  }

  const pinHash = await bcrypt.hash(pin, 10);

  if (maintenanceUserId) {
    const worker = await prisma.maintenanceUser.findFirst({
      where: {
        id: maintenanceUserId,
        propertyId,
      },
    });

    if (!worker) {
      redirect(
        `/manager/properties/${propertyId}/pin-reset?maintenanceError=${encodeURIComponent(
          "Maintenance worker not found"
        )}`
      );
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.maintenanceUser.update({
        where: { id: maintenanceUserId },
        data: {
          pinHash,
        },
      });

      await tx.auditLog.create({
        data: {
          propertyId,
          actorType: session.role,
          actorManagementUserId: session.managementUserId || null,
          action: "MAINTENANCE_PIN_RESET",
          targetType: "MAINTENANCE_USER",
          targetId: maintenanceUserId,
          summary: `Maintenance PIN reset for ${worker.displayName}`,
          metadataJson: JSON.stringify({
            workerName: worker.displayName,
          }),
        },
      });
    });

    redirect(`/manager/properties/${propertyId}/pin-reset?maintenanceSuccess=1`);
  }

  if (!workerName) {
    redirect(
      `/manager/properties/${propertyId}/pin-reset?maintenanceError=${encodeURIComponent(
        "Worker name is required when creating a new maintenance login"
      )}`
    );
  }

  const existingByName = await prisma.maintenanceUser.findFirst({
    where: {
      propertyId,
      displayName: workerName,
    },
  });

  if (existingByName) {
    redirect(
      `/manager/properties/${propertyId}/pin-reset?maintenanceError=${encodeURIComponent(
        "A maintenance worker with that name already exists"
      )}`
    );
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.maintenanceUser.create({
      data: {
        propertyId,
        displayName: workerName,
        pinHash,
        createdByManagementUserId: session.managementUserId || null,
      },
    });

    await tx.auditLog.create({
      data: {
        propertyId,
        actorType: session.role,
        actorManagementUserId: session.managementUserId || null,
        action: "MAINTENANCE_USER_CREATED_WITH_PIN",
        targetType: "MAINTENANCE_USER",
        targetId: created.id,
        summary: `Maintenance user created: ${workerName}`,
        metadataJson: JSON.stringify({
          workerName,
        }),
      },
    });
  });

  redirect(`/manager/properties/${propertyId}/pin-reset?maintenanceSuccess=1`);
}

type PageSearchParams = {
  maintenanceError?: string;
  maintenanceSuccess?: string;
};

type MaintenanceUserRow = {
  id: string;
  displayName: string;
};

export default async function PinResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<PageSearchParams>;
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
      maintenanceUsers: {
        orderBy: { displayName: "asc" },
      },
    },
  });

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }

  const maintenanceError = qp?.maintenanceError
    ? decodeURIComponent(qp.maintenanceError)
    : "";
  const maintenanceSuccess = qp?.maintenanceSuccess === "1";


  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">PIN Reset</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {property.name} ({property.propertyCode})
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <p>Tenant PIN reset is available from the canonical Unit Detail tenant page.</p>
        <a href="/manager/dashboard" className="underline">Manager dashboard</a>
      </div>

      {canManageMaintenancePins(session.role) ? (
      <div className="space-y-4 rounded-xl border bg-white p-4">
          <div>
            <h2 className="text-lg font-semibold">
              Maintenance PIN Create / Reset
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
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

            <label className="block space-y-1">
              <div className="text-sm font-medium">Existing Worker</div>
              <select
                name="maintenanceUserId"
                className="w-full rounded-lg border px-3 py-2"
                defaultValue=""
              >
                <option value="">Create new worker instead</option>
                {property.maintenanceUsers.map((worker: MaintenanceUserRow) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium">New Worker Name</div>
              <input
                name="workerName"
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Only used when creating a new maintenance login"
              />
            </label>

            <label className="block space-y-1">
              <div className="text-sm font-medium">4-Digit PIN</div>
              <input
                name="pin"
                inputMode="numeric"
                maxLength={4}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="1234"
                required
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-black px-4 py-2 text-white"
            >
              Save Maintenance PIN
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
