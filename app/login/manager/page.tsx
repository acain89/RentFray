// app/login/manager/page.tsx

import ManagerLoginClient from "./ManagerLoginClient";

export default function ManagerLoginPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const propertyCode = searchParams?.code || "";

  return <ManagerLoginClient propertyCode={propertyCode} />;
}