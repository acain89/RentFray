import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagementSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function fmtDate(value: Date | null) {
  return value ? value.toLocaleDateString("en-US") : "—";
}

export default async function UnitHistory({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementSession();
  if (!session.propertyId) throw new Error("Unauthorized");
  const { id } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id, propertyId: session.propertyId },
    include: {
      property: { select: { name: true } },
      tenantAssignments: { where: { propertyId: session.propertyId },
        orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!unit) notFound();
  const now = new Date();
  type Assignment = (typeof unit.tenantAssignments)[number];
  const current = unit.tenantAssignments.filter((a: Assignment) => a.isCurrent && (!a.moveOutDate || a.moveOutDate > now));
  const history = unit.tenantAssignments.filter((a: Assignment) => !current.some((active: Assignment) => active.id === a.id));
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Unit History</h1>
      <div>Property: {unit.property.name}<br />Unit: {unit.unitNumber}</div>
      <section>
        <h2 className="text-lg font-semibold">Current Tenant</h2>
        {!current.length ? <div>Vacant</div> : current.map((a: Assignment) => (
          <div key={a.id} className="rounded border p-3 mt-2">
            <strong>{`${a.firstName || ""} ${a.lastName || ""}`.trim() || "—"}</strong>
            <div>Move-in: {fmtDate(a.moveInDate)}</div>
            <div>Status: Active</div>
            {a.moveOutDate ? <div>Scheduled move-out: {fmtDate(a.moveOutDate)}</div> : null}
          </div>
        ))}
      </section>
      <section>
        <h2 className="text-lg font-semibold">Previous Tenants</h2>
        {!history.length ? <div>No history</div> : history.map((a: Assignment) => (
          <div key={a.id} className="rounded border p-3 mt-2">
            <strong>{`${a.firstName || ""} ${a.lastName || ""}`.trim() || "—"}</strong>
            <div>Move-in: {fmtDate(a.moveInDate)}</div>
            <div>Move-out: {fmtDate(a.moveOutDate)}</div>
            <div>Status: Past</div>
          </div>
        ))}
      </section>
    </div>
  );
}
