import { redirect } from "next/navigation";
import { requireManagementSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireManagementSession();
  if (!session.propertyId) throw new Error("Unauthorized");
  redirect("/manager/dashboard");
}
