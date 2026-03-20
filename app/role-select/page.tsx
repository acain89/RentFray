// app/role-select/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";

export default function RoleSelectPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams?.code?.trim() || "";

  if (!code) {
    redirect("/property-code");
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <div className="w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              Select Role
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Choose how you want to sign in.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href={`/login/manager?code=${encodeURIComponent(code)}`}
              className="block w-full rounded-xl border border-neutral-300 px-4 py-4 text-center text-sm font-medium hover:border-black"
            >
              Manager
            </Link>

            <Link
              href={`/login/tenant?code=${encodeURIComponent(code)}`}
              className="block w-full rounded-xl border border-neutral-300 px-4 py-4 text-center text-sm font-medium hover:border-black"
            >
              Tenant
            </Link>

            <Link
              href={`/login/maintenance?code=${encodeURIComponent(code)}`}
              className="block w-full rounded-xl border border-neutral-300 px-4 py-4 text-center text-sm font-medium hover:border-black"
            >
              Maintenance
            </Link>
          </div>

          <div className="mt-6">
            <Link
              href="/property-code"
              className="text-sm text-neutral-600 underline underline-offset-4"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}