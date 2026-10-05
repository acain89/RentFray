import { notFound, redirect } from "next/navigation";
import { requireManagementSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementSession();
  const { id } = await params;
  if (!session.propertyId || session.propertyId !== id) notFound();
  redirect("/manager/dashboard");
}
