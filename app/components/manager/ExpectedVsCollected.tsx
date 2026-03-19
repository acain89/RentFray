"use client";

type Data = {
  expectedRentThisCycle: number;
  collectedThisCycle: number;
  remainingThisCycle: number;
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function percent(expected: number, collected: number) {
  if (!expected) return 0;
  return Math.min(100, Math.round((collected / expected) * 100));
}

export default function ExpectedVsCollected({
  data,
}: {
  data: Data;
}) {
  const pct = percent(
    data.expectedRentThisCycle,
    data.collectedThisCycle
  );

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
      <div className="text-sm text-gray-500">
        Expected vs Collected
      </div>

      <div className="space-y-1">
        <Row label="Expected" value={money(data.expectedRentThisCycle)} />
        <Row label="Collected" value={money(data.collectedThisCycle)} />
        <Row label="Remaining" value={money(data.remainingThisCycle)} />
      </div>

      <div className="h-3 w-full bg-gray-200 rounded overflow-hidden">
        <div
          className="h-full bg-black"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="text-xs text-gray-500 text-right">
        {pct}% collected
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}