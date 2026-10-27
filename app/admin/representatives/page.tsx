import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import RepresentativeAdminClient from "./RepresentativeAdminClient";
export const dynamic = "force-dynamic";
export default async function RepresentativesPage() {
  const session = await getSession({ strictAuthority: true });
  if (!session || session.role !== "ADMIN") redirect("/login/admin");
  return <RepresentativeAdminClient />;
}
