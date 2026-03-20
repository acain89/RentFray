import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function TenantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  if (!session || session.role !== "TENANT") {
    redirect("/tenant");
  }

  return <>{children}</>;
}