import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export const dynamic = "force-dynamic";

export default async function ManagerHomePage() {
  const [propertyCount, unitCount, occupiedUnitCount, properties, units] =
    await Promise.all([
      prisma.property.count(),
      prisma.unit.count(),
      prisma.unit.count({
        where: { occupancyStatus: "OCCUPIED" },
      }),
      prisma.property.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          maintenanceRequests: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.unit.findMany({
        select: {
          id: true,
          propertyId: true,
        },
      }),
    ]);

  const unitStats = await Promise.all(
    units.map(async (unit: (typeof units)[number]) => {
      const ledger = await getUnitLedgerSummary(unit.id);
      const delinquency = await getUnitDelinquencySummary(unit.id);

      return {
        propertyId: unit.propertyId,
        receivable: Math.max(Number(ledger.balance || 0), 0),
        collected: Number(ledger.totalPaid || 0),
        balance: Number(ledger.balance || 0),
        isDelinquent: Boolean(delinquency.isDelinquent),
      };
    })
  );

  const totalReceivables = unitStats.reduce((sum, r) => sum + r.receivable, 0);
  const totalCollected = unitStats.reduce((sum, r) => sum + r.collected, 0);
  const totalBalance = unitStats.reduce((sum, r) => sum + r.balance, 0);
  const totalDelinquent = unitStats
    .filter((r) => r.isDelinquent)
    .reduce((sum, r) => sum + r.balance, 0);

  const delinquentUnits = unitStats.filter((r) => r.isDelinquent).length;

  const propertyMap = new Map<
    string,
    {
      balance: number;
      receivable: number;
      collected: number;
      delinquent: number;
      units: number;
    }
  >();

  for (const unit of units) {
    if (!propertyMap.has(unit.propertyId)) {
      propertyMap.set(unit.propertyId, {
        balance: 0,
        receivable: 0,
        collected: 0,
        delinquent: 0,
        units: 0,
      });
    }
  }

  unitStats.forEach((stat) => {
    const row = propertyMap.get(stat.propertyId)!;

    row.balance += stat.balance;
    row.receivable += stat.receivable;
    row.collected += stat.collected;
    row.units += 1;

    if (stat.isDelinquent) {
      row.delinquent += stat.balance;
    }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manager Portal</h1>
          <div className="text-sm text-gray-600">
            Preview-first property operations
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/manager/properties/new"
            className="inline-block rounded bg-black px-4 py-2 text-sm text-white"
          >
            Create Property
          </Link>

          <Link
            href="/manager/properties"
            className="inline-block rounded border px-4 py-2 text-sm"
          >
            Open Properties
          </Link>

          <Link
            href="/manager/maintenance"
            className="inline-block rounded border px-4 py-2 text-sm"
          >
            Maintenance
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Properties</div>
          <div className="text-lg font-semibold">{propertyCount}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Units</div>
          <div className="text-lg font-semibold">{unitCount}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Occupied</div>
          <div className="text-lg font-semibold">{occupiedUnitCount}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Portfolio Balance</div>
          <div className="text-lg font-semibold">{money(totalBalance)}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Total Collected</div>
          <div className="text-lg font-semibold">{money(totalCollected)}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Delinquent</div>
          <div className="text-lg font-semibold">{money(totalDelinquent)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/manager/properties"
          className="rounded border p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Properties</div>
        </Link>

        <Link
          href="/manager/units"
          className="rounded border p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Units</div>
        </Link>

        <div className="rounded border p-4">
          <div className="font-semibold">Delinquency</div>
          <div className="mt-1 text-sm text-gray-600">
            {delinquentUnits} unit{delinquentUnits === 1 ? "" : "s"} delinquent
          </div>
        </div>
      </div>

      <div className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Portfolio Breakdown</h2>

        {properties.length === 0 ? (
          <div className="text-sm text-gray-500">No properties found.</div>
        ) : (
          <div className="space-y-2">
            {properties.map((property: (typeof properties)[number]) => {
              const stats = propertyMap.get(property.id) || {
                balance: 0,
                receivable: 0,
                collected: 0,
                delinquent: 0,
                units: 0,
              };

              const openMaintenance = property.maintenanceRequests.filter(
                (r: (typeof property.maintenanceRequests)[number]) => r.status === "OPEN"
              ).length;

              const inProgressMaintenance = property.maintenanceRequests.filter(
                (r: (typeof property.maintenanceRequests)[number]) =>
                  r.status === "IN_PROGRESS"
              ).length;

              return (
                <div
                  key={property.id}
                  className="grid grid-cols-1 gap-3 rounded border p-3 md:grid-cols-8 md:items-center"
                >
                  <div>
                    <div className="text-xs text-gray-500">Property</div>
                    <div className="font-medium">{property.name}</div>
                    <div className="text-xs text-gray-500">{property.code}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Units</div>
                    <div>{stats.units}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Balance</div>
                    <div>{money(stats.balance)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Receivable</div>
                    <div>{money(stats.receivable)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Collected</div>
                    <div>{money(stats.collected)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Delinquent</div>
                    <div>{money(stats.delinquent)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Maintenance</div>
                    <div className="text-sm">
                      Open: {openMaintenance} · In Progress:{" "}
                      {inProgressMaintenance}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/manager/properties/${property.id}`}
                      className="text-sm underline"
                    >
                      Open
                    </Link>

                    <Link
                      href={`/manager/properties/${property.id}/maintenance`}
                      className="text-sm underline"
                    >
                      Maintenance
                    </Link>

                    <a
                      href={`/api/exports/balances?propertyId=${property.id}`}
                      className="text-sm underline"
                    >
                      Export
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}