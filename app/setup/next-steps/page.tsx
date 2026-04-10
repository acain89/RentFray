import Link from "next/link";

type NextStepsPageProps = {
  searchParams?: Promise<{
    code?: string;
  }>;
};

export default async function NextStepsPage({
  searchParams,
}: NextStepsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const propertyCode = resolvedSearchParams?.code ?? "XXXX";

  return (
    <main className="min-h-screen bg-[#dfe7ee] px-4 py-8 text-[#0f172a]">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-[#cbd5e1] bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#475569]">
            RentFray
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Next Steps
          </h1>

          <p className="mt-2 text-sm text-[#64748b]">
            You're set up. Just finish these quick steps.
          </p>
        </div>

        <div className="mt-8 space-y-5 text-sm leading-relaxed text-[#334155]">
          <div>
            <strong>1. Your property code:</strong>
            <div className="mt-1 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] px-4 py-3 text-lg font-semibold tracking-wide">
              {propertyCode}
            </div>
            <p className="mt-1 text-xs text-[#64748b]">
              Write this down. You will need it anytime you log in.
            </p>
          </div>

          <div>
            <strong>2. Owner Account</strong>
            <p className="mt-1">
              This is your Owner Account. It is the only account that can access or
              change banking information. If needed, update the login to transfer
              control.
            </p>
          </div>

          <div>
            <strong>3. Add banking info</strong>
            <p className="mt-1">
              Go to the dashboard and click <strong>Accnt</strong> to connect your
              payout account. This is required before receiving payments.
            </p>
          </div>

          <div>
            <strong>4. Activate tenants</strong>
            <p className="mt-1">
              Print the Tenant Instructions sheet. Write the property code and the
              correct Tier number for each tenant.
            </p>
          </div>

          <div>
            <strong>5. You're ready</strong>
            <p className="mt-1">
              Your property is now fully set up. Use the dashboard buttons and unit
              controls to manage charges, credits, prorations, and more.
            </p>
          </div>
        </div>

        <Link
          href="/manager/dashboard"
          className="mt-8 block w-full rounded-2xl bg-[#0f172a] px-5 py-4 text-center text-sm font-semibold text-white transition hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}