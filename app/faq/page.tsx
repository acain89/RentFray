export default function FAQPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">Frequently Asked Questions</h1>

      <div className="space-y-6 text-sm text-slate-700">
        <div>
          <p className="font-semibold">Is RentFray really free?</p>
          <p>
            Yes. Businesses never pay. A small processing fee is added to tenant
            payments.
          </p>
        </div>

        <div>
          <p className="font-semibold">How do I get paid?</p>
          <p>
            Tap “ACCT” and connect your bank. Stripe handles payouts directly to
            you.
          </p>
        </div>

        <div>
          <p className="font-semibold">How do tenants join?</p>
          <p>
            Share your property code. Tenants enter unit + PIN and they’re in.
          </p>
        </div>

        <div>
          <p className="font-semibold">Need help?</p>
          <p>
            Email{" "}
            <a
              href="mailto:helpdesk@rentfray.com"
              className="text-blue-600 underline"
            >
              helpdesk@rentfray.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}