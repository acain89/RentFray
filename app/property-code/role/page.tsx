// app/property-code/role/page.tsx

"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function RoleSelectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const code = searchParams.get("code");

  if (!code) {
    // Hard fail — user skipped step
    router.replace("/property-code");
    return null;
  }

  function goTo(role: "manager" | "tenant" | "maintenance") {
    router.push(`/${role}/login?code=${encodeURIComponent(code)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-white text-black">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Select Role
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Choose how you want to continue
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => goTo("manager")}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium hover:border-black"
          >
            Manager
          </button>

          <button
            onClick={() => goTo("tenant")}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium hover:border-black"
          >
            Tenant
          </button>

          <button
            onClick={() => goTo("maintenance")}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium hover:border-black"
          >
            Maintenance
          </button>
        </div>
      </div>
    </main>
  );
}