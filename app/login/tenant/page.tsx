// app/login/tenant/page.tsx

import TenantLoginClient from "./TenantLoginClient";

export default function TenantLoginPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const propertyCode = searchParams?.code || "";

  return <TenantLoginClient propertyCode={propertyCode} />;
}