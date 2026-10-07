import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManagementSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementSession();
  const { id } = await params;
  if (!session.propertyId || session.propertyId !== id) notFound();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Tenant creation retired</h1>
      <p>Tenants establish their assignment through canonical tenant activation.</p>
      <Link href="/manager/dashboard" className="rounded border px-4 py-2">Manager dashboard</Link>
    </div>
  );
}
