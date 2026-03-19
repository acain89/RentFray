import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function UnitsPage() {
  const units = await prisma.unit.findMany({
    include: {
      assignments: {
        include: { tenant: true },
      },
    },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Units</h1>

      <div className="space-y-3">
        {units.map((u) => {
          const tenant = u.assignments[0]?.tenant;

          return (
            <Link
              key={u.id}
              href={`/manager/units/${u.id}`}
              className="block border p-4 rounded hover:bg-gray-50"
            >
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">
                    Unit {u.unitNumber}
                  </div>
                  <div className="text-sm text-gray-500">
                    {tenant?.name || "Vacant"}
                  </div>
                </div>

                <div>${u.marketRent}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}