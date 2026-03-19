import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPin, isValidFourDigitPin } from "@/lib/pin";
import { getProrationSummary } from "@/lib/proration";
import AssignmentFields from "./AssignmentFields";

export const dynamic = "force-dynamic";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function createTenantAndAssign(formData: FormData) {
  "use server";

  const propertyId = clean(formData.get("propertyId"));
  const unitId = clean(formData.get("unitId"));
  const name = clean(formData.get("name"));
  const email = clean(formData.get("email"));
  const phone = clean(formData.get("phone"));
  const pin = clean(formData.get("pin"));
  const moveInRaw = clean(formData.get("moveIn"));
  const postProratedRent = clean(formData.get("postProratedRent")) === "on";

  if (!propertyId || !unitId || !name) {
    throw new Error("Property, unit, and tenant name are required.");
  }

  if (!isValidFourDigitPin(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }

  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      propertyId,
    },
    include: {
      assignments: {
        where: { moveOut: null },
        select: { id: true },
      },
    },
  });

  if (!unit) {
    throw new Error("Unit not found.");
  }

  if (unit.assignments.length > 0) {
    throw new Error("Unit already has an active tenant.");
  }

  const moveIn = moveInRaw ? new Date(`${moveInRaw}T00:00:00`) : new Date();

  if (Number.isNaN(moveIn.getTime())) {
    throw new Error("Invalid move-in date.");
  }

  const pinHash = hashPin(pin);

  const tenant = await prisma.tenant.create({
    data: {
      propertyId,
      name,
      email,
      phone,
      pinHash,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await prisma.unitAssignment.create({
    data: {
      unitId,
      tenantId: tenant.id,
      moveIn,
    },
  });

  await prisma.unit.update({
    where: { id: unitId },
    data: {
      occupancyStatus: "OCCUPIED",
    },
  });

  if (postProratedRent) {
    const proration = getProrationSummary(Number(unit.marketRent || 0), moveIn);

    if (proration.proratedAmount > 0) {
      await prisma.ledgerEntry.create({
        data: {
          propertyId,
          unitId: unit.id,
          tenantId: tenant.id,
          type: "RENT_CHARGE",
          amount: proration.proratedAmount,
          effectiveDate: moveIn,
          memo: `Prorated first rent (${proration.occupiedDays}/${proration.totalDays} days)`,
          source: "SYSTEM_PRORATION",
          sourceRef: tenant.id,
        },
      });
    }
  }

  redirect(`/manager/units/${unitId}`);
}

export default async function NewTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      units: {
        orderBy: { unitNumber: "asc" },
        include: {
          assignments: {
            where: { moveOut: null },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!property) {
    return <div className="p-6">Property not found</div>;
  }

  const availableUnits = property.units.filter((u) => u.assignments.length === 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Tenant + Assign Unit</h1>
        <div className="text-sm text-gray-600">
          {property.name} · {property.code}
        </div>
      </div>

      {availableUnits.length === 0 ? (
        <div className="rounded border p-4 text-sm text-gray-600">
          No available units to assign.
        </div>
      ) : (
        <form
          action={createTenantAndAssign}
          className="max-w-2xl space-y-4 rounded border p-4"
        >
          <input type="hidden" name="propertyId" value={property.id} />

          <AssignmentFields
            units={availableUnits.map((unit) => ({
              id: unit.id,
              unitNumber: unit.unitNumber,
              marketRent: Number(unit.marketRent || 0),
            }))}
          />

          <div className="space-y-1">
            <label className="text-sm font-medium">Tenant Name</label>
            <input
              name="name"
              type="text"
              required
              className="w-full rounded border px-3 py-2"
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              className="w-full rounded border px-3 py-2"
              placeholder="john@test.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Phone</label>
            <input
              name="phone"
              type="text"
              className="w-full rounded border px-3 py-2"
              placeholder="1234567890"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">4-Digit PIN</label>
            <input
              name="pin"
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              minLength={4}
              required
              defaultValue="1234"
              className="w-full rounded border px-3 py-2"
              placeholder="1234"
            />
            <div className="text-xs text-gray-500">
              Tenant login uses Property Code + Unit Number + this 4-digit PIN.
            </div>
          </div>

          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-white"
          >
            Create Tenant + Assign
          </button>
        </form>
      )}
    </div>
  );
}