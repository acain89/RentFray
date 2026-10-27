import { redirect } from "next/navigation";
import { getRepresentativeSession } from "@/lib/representativeSession";
import { getRepresentativeDashboard } from "@/lib/representativeReports";
import RepresentativeDashboard from "./RepresentativeDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function RepresentativePortalPage() {
  const session = await getRepresentativeSession();
  if (!session) redirect("/login/representative");
  const report = await getRepresentativeDashboard(session.id);
  return <RepresentativeDashboard initial={report} />;
}
