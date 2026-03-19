"use client";

type StatusCountsData = {
  paid: number;
  grace: number;
  partial: number;
  delinquent: number;
  vacant: number;
};

export default function StatusCounts({
  counts,
  onSelect,
}: {
  counts: StatusCountsData;
  onSelect?: (status: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <StatusCard label="Paid" value={counts.paid} status="PAID" onSelect={onSelect} />
      <StatusCard label="Grace" value={counts.grace} status="GRACE" onSelect={onSelect} />
      <StatusCard label="Partial" value={counts.partial} status="PARTIAL" onSelect={onSelect} />
      <StatusCard label="Delinquent" value={counts.delinquent} status="DELINQUENT" onSelect={onSelect} />
      <StatusCard label="Vacant" value={counts.vacant} status="VACANT" onSelect={onSelect} />
    </div>
  );
}

function StatusCard({
  label,
  value,
  status,
  onSelect,
}: {
  label: string;
  value: number;
  status: string;
  onSelect?: (status: string) => void;
}) {
  const color = getColor(status);

  return (
    <button
      onClick={() => onSelect?.(status)}
      className="rounded-lg border bg-white p-4 text-left shadow-sm hover:shadow-md transition"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`h-2 w-2 rounded-full ${color}`} />
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </button>
  );
}

function getColor(status: string) {
  switch (status) {
    case "PAID":
      return "bg-green-500";
    case "GRACE":
      return "bg-blue-500";
    case "PARTIAL":
      return "bg-yellow-500";
    case "DELINQUENT":
      return "bg-red-500";
    case "VACANT":
      return "bg-gray-400";
    default:
      return "bg-gray-300";
  }
}