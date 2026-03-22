// app/admin/requests/page.tsx

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function fmtDate(value: Date) {
  return new Date(value).toLocaleString("en-US");
}

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/* =========================
   APPROVE
========================= */
async function approveRequest(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  const request = await prisma.propertyRequest.findUnique({
    where: { id },
  });

  if (!request) return;

  let propertyCode = generateCode();

  let exists = await prisma.property.findFirst({
    where: { propertyCode },
    select: { id: true },
  });

  while (exists) {
    propertyCode = generateCode();
    exists = await prisma.property.findFirst({
      where: { propertyCode },
      select: { id: true },
    });
  }

  const property = await prisma.property.create({
    data: {
      name: request.propertyName,
      propertyCode,
      isActive: true,
    },
  });

  await prisma.propertyRequest.delete({
    where: { id },
  });

  redirect(`/admin/properties/${property.id}`);
}

/* =========================
   REJECT
========================= */
async function rejectRequest(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) return;

  await prisma.propertyRequest.delete({
    where: { id },
  });

  redirect("/admin/requests");
}

export default async function AdminRequestsPage() {
  const requests = await prisma.propertyRequest.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      propertyName: true,
      propertyType: true,
      address: true,
      contactName: true,
      contactInfo: true,
      unitCount: true,
      notes: true,
      createdAt: true,
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-lg md:text-xl font-semibold">
        Property Requests
      </h1>

      {requests.length === 0 && (
        <div className="border border-dashed rounded-xl p-6 text-center text-sm text-gray-600">
          No requests yet.
        </div>
      )}

      {/* MOBILE */}
      <div className="space-y-3 md:hidden">
        {requests.map((r: typeof requests[number]) => (
          <div
            key={r.id}
            className="border rounded-xl p-4 bg-white space-y-3"
          >
            <div className="font-medium">{r.propertyName}</div>

            <div className="text-sm text-gray-600">
              {r.propertyType}
            </div>

            <div className="text-sm text-gray-600">
              {r.address}
            </div>

            <div className="text-sm">
              {r.contactName} — {r.contactInfo}
            </div>

            <div className="text-xs text-gray-500">
              Units: {r.unitCount || "—"}
            </div>

            {r.notes && (
              <div className="text-sm text-gray-700">
                {r.notes}
              </div>
            )}

            <div className="text-xs text-gray-400">
              {fmtDate(r.createdAt)}
            </div>

            <div className="flex gap-2 pt-2">
              <form action={approveRequest} className="flex-1">
                <input type="hidden" name="id" value={r.id} />
                <button className="w-full bg-black text-white py-2 rounded-lg text-sm">
                  Approve
                </button>
              </form>

              <form action={rejectRequest} className="flex-1">
                <input type="hidden" name="id" value={r.id} />
                <button className="w-full border py-2 rounded-lg text-sm">
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3">Property</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Units</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((r: typeof requests[number]) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.propertyName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.address}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {r.propertyType}
                  </td>

                  <td className="px-4 py-3">
                    <div>{r.contactName}</div>
                    <div className="text-xs text-gray-500">
                      {r.contactInfo}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {r.unitCount || "—"}
                  </td>

                  <td className="px-4 py-3">
                    {fmtDate(r.createdAt)}
                  </td>

                  <td className="px-4 py-3 text-right space-x-3">
                    <form action={approveRequest} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <button className="underline text-sm">
                        Approve
                      </button>
                    </form>

                    <form action={rejectRequest} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <button className="underline text-sm text-gray-500">
                        Reject
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}