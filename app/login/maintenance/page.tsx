// app/login/maintenance/page.tsx

import MaintenanceLoginClient from "./MaintenanceLoginClient";

export default function MaintenanceLoginPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const propertyCode = searchParams?.code || "";

  return <MaintenanceLoginClient propertyCode={propertyCode} />;
}