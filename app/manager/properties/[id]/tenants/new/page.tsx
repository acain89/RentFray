// app/manager/properties/[id]/tenants/new/page.tsx

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hashPin, isValidFourDigitPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function parseMoveInDate(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return new Date();

  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();

  return parsed;
}

async function createTenantAssignment(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session || !["OWNER", "MANAGER", "STAFF"].includes(session.role)) {
    redirect("/");
  }

  const propertyId = clean(formData.get("propertyId"));
  const unitId = clean(formData.get("unitId"));
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  const moveIn = clean(formData.get("moveIn"));
  const activateNow = clean(formData.get("activateNow")) === "yes";
  const pin = clean(formData.get("pin"));

  if (!propertyId) {
    redirect("/manager/properties");
  }

  if (session.propertyId !== propertyId) {
    redirect("/manager/dashboard");
  }

  if (!unitId || !firstName || !lastName) {
    redirect(
      `/manager/properties/${propertyId}/tenants/new?error=Missing required fields`
    );
  }

  if (activateNow && !isValidFourDigitPin(pin)) {
    redirect(
      `/manager/properties/${propertyId}/tenants/new?error=PIN must be exactly 4 digits`
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
    redirect(`/manager/properties/${propertyId}/tenants/new?error=Unit not found`);
  }

  if (unit.assignments.length > 0) {
    redirect(
      `/manager/properties/${propertyId}/tenants/new?error=Unit already has an active tenant`
    );
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const pinHash = activateNow ? await hashPin(pin) : null;

  await prisma.$transaction(async (tx) => {
    await tx.tenantAssignment.create({
      data: {
        unitId,
        moveIn: parseMoveInDate(moveIn),
      },
    });

    await tx.unit.update({
      where: { id: unitId },
      data: {
        tenantName: fullName,
        portalActivated: activateNow,
        tenantPinHash: pinHash,
      },
    });

    await tx.auditLog.create({
      data: {
        propertyId,
        actorRole: session.role,
        actorLabel: session.managementUserId || "management",
        action: "TENANT_ASSIGNED",
        entityType: "UNIT",
        entityId: unitId,
        notes: JSON.stringify({
          unitNumber: unit.unitNumber,
          tenantName: fullName,
          moveIn: moveIn || null,
          activateNow,
        }),
      },
    });
  });

  redirect(`/manager/properties/${propertyId}?assigned=1`);
}

export default async function NewTenantAssignmentPage({
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
            take: 1,
          },
        },
      },
    },
  });

  if (!property) {
    return <div className="p-6">Property not found.</div>;
  }

  const availableUnits = property.units.filter(
    (unit: { assignments: { id: string }[] }) => unit.assignments.length === 0
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assign Tenant</h1>
        <p className="text-sm text-neutral-600 mt-1">
          {property.name} ({property.code})
        </p>
      </div>

      {availableUnits.length === 0 ? (
        <div className="border rounded-xl p-4 bg-white text-sm text-neutral-700">
          No available units.
        </div>
      ) : null}

      {error ? (
        <div className="border rounded-xl p-4 bg-white text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {availableUnits.length > 0 ? (
        <form action={createTenantAssignment} className="border rounded-xl p-4 bg-white space-y-4">
          <input type="hidden" name="propertyId" value={property.id} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <div className="text-sm font-medium">Unit</div>
              <select name="unitId" className="w-full border rounded-lg px-3 py-2" required>
                {availableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-sm font-medium">Move-In Date</div>
              <input
                type="date"
                name="moveIn"
                className="w-full border rounded-lg px-3 py-2"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm font-medium">First Name</div>
              <input
                name="firstName"
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm font-medium">Last Name</div>
              <input
                name="lastName"
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </label>
          </div>

          <div className="border rounded-xl p-4 space-y-3">
            <div className="font-medium">Portal Activation</div>

            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="activateNow" value="no" defaultChecked />
              Do not activate now
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="activateNow" value="yes" />
              Activate now with a 4-digit PIN
            </label>

            <label className="space-y-1 block">
              <div className="text-sm font-medium">4-Digit PIN</div>
              <input
                name="pin"
                inputMode="numeric"
                maxLength={4}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Only required if activating now"
              />
            </label>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-black text-white"
          >
            Assign Tenant
          </button>
        </form>
      ) : null}
    </div>
  );
}