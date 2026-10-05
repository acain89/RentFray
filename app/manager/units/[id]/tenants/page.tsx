import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManagementSession, requireManagerLevelSession } from "@/lib/session";
import { hashPin, isValidFourDigitPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

function fmtDate(value: Date | null) {
  return value ? value.toLocaleDateString("en-US") : "—";
}

export default async function UnitTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementSession();
  if (!session.propertyId) throw new Error("Unauthorized");
  const { id } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id, propertyId: session.propertyId },
    include: {
      property: { select: { name: true, propertyCode: true } },
      tenantAssignments: {
        where: { propertyId: session.propertyId, isCurrent: true,
          OR: [{ moveOutDate: null }, { moveOutDate: { gt: new Date() } }] },
        orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });
  if (!unit) notFound();
  const assignment = unit.tenantAssignments[0] ?? null;
  const canMutate = session.role === "OWNER" || session.role === "MANAGER";
  const tenantName = assignment ? `${assignment.firstName || ""} ${assignment.lastName || ""}`.trim() : "";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Unit {unit.unitNumber} Tenant</h1>
        <div className="text-sm text-gray-600">{unit.property.name} · {unit.property.propertyCode}</div>
        <div>Status: {assignment ? "Occupied" : "Vacant"}</div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`/manager/units/${unit.id}`} className="rounded border px-4 py-2">Back to Unit</Link>
        {assignment && canMutate ? (
          <Link href="/manager/dashboard" className="rounded border px-4 py-2">Manage Tenancy</Link>
        ) : null}
      </div>
      {!assignment ? <div>No active tenant is assigned to this unit.</div> : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div><div>Tenant Name</div><div>{tenantName || "—"}</div></div>
            <div><div>Email</div><div>{assignment.email || "—"}</div></div>
            <div><div>Phone</div><div>{assignment.phone || "—"}</div></div>
            <div><div>Move In Date</div><div>{fmtDate(assignment.moveInDate)}</div></div>
            <div><div>Scheduled Move Out Date</div><div>{fmtDate(assignment.moveOutDate)}</div></div>
          </div>
          {canMutate ? <ResetPinCard propertyId={session.propertyId} unitId={unit.id}
            assignmentId={assignment.id} tenantName={tenantName} /> : null}
        </>
      )}
    </div>
  );
}

function ResetPinCard({ propertyId, unitId, assignmentId, tenantName }: {
  propertyId: string; unitId: string; assignmentId: string; tenantName: string;
}) {
  async function resetPin(formData: FormData) {
    "use server";
    const session = await requireManagerLevelSession();
    if (!session.propertyId || session.propertyId !== propertyId) throw new Error("Forbidden");
    const pin = String(formData.get("pin") || "").trim();
    if (!isValidFourDigitPin(pin)) throw new Error("PIN must be exactly 4 digits.");
    const tenantPinHash = hashPin(pin);
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const currentAssignment = { id: assignmentId, propertyId, unitId, isCurrent: true,
        OR: [{ moveOutDate: null }, { moveOutDate: { gt: new Date() } }] };
      const unit = await tx.unit.findFirst({
        where: { id: unitId, propertyId, tenantAssignments: { some: currentAssignment } },
        select: { id: true, unitNumber: true },
      });
      if (!unit) throw new Error("The displayed tenant assignment is no longer current.");
      // Repeat the assignment predicate at the write boundary; never reset a replacement tenancy.
      await tx.unit.update({
        where: { id: unitId, propertyId, tenantAssignments: { some: currentAssignment } },
        data: { tenantPinHash },
      });
      await tx.auditLog.create({ data: {
        propertyId, actorType: session.role, actorManagementUserId: session.managementUserId || null,
        action: "TENANT_PIN_RESET", targetType: "UNIT", targetId: unitId,
        summary: `Tenant PIN reset for unit ${unit.unitNumber}`,
        metadataJson: JSON.stringify({ unitNumber: unit.unitNumber, tenantAssignmentId: assignmentId }),
      } });
    });
  }
  return (
    <form action={resetPin} className="max-w-xl rounded border p-4 space-y-4">
      <h2 className="text-lg font-semibold">Reset Tenant PIN</h2>
      <div>Reset PIN for {tenantName || "current tenant"}.</div>
      <label className="block">New 4-Digit PIN
        <input name="pin" type="text" inputMode="numeric" pattern="[0-9]{4}"
          maxLength={4} minLength={4} required className="block border px-3 py-2" />
      </label>
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">Reset PIN</button>
    </form>
  );
}
