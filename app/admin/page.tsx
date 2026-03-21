// app/admin/page.tsx

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function unlockAdmin(formData: FormData) {
  "use server";

  const pin = String(formData.get("pin") || "").trim();
  const expectedPin = process.env.RENTFRAY_ADMIN_PIN || "";

  if (!expectedPin) {
    redirect("/admin?error=setup");
  }

  if (pin !== expectedPin) {
    redirect("/admin?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set("rf_admin_unlocked", "yes", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/admin");
}

async function lockAdmin() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.delete("rf_admin_unlocked");
  redirect("/admin");
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = (await searchParams) || {};
  const cookieStore = await cookies();
  const unlocked = cookieStore.get("rf_admin_unlocked")?.value === "yes";

  const error =
    params.error === "invalid"
      ? "Invalid PIN."
      : params.error === "setup"
      ? "Admin PIN is not configured."
      : "";

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-[#dfe7ee] text-[#0f172a]">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center px-8 py-10 lg:px-12 lg:py-14">
          <div className="grid w-full gap-8 lg:grid-cols-[1fr_0.8fr]">
            {/* LEFT */}
            <section>
              <div className="mb-6 text-xs font-semibold tracking-[0.24em] text-[#c28a12]">
                RENTFRAY
              </div>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight lg:text-6xl">
                Admin
                <br />
                control access.
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#475569]">
                Protected access for platform controls, property setup, and
                internal management tools.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 bg-[#eef3f7] p-5 shadow-sm">
                  <div className="text-lg font-semibold">Protected</div>
                  <p className="mt-3 text-sm text-[#475569]">
                    Admin controls stay behind a separate PIN gate.
                  </p>
                </div>

                <div className="rounded-2xl border border-black/10 bg-[#eef3f7] p-5 shadow-sm">
                  <div className="text-lg font-semibold">Internal</div>
                  <p className="mt-3 text-sm text-[#475569]">
                    Reserved for setup, oversight, and platform-level actions.
                  </p>
                </div>
              </div>
            </section>

            {/* RIGHT */}
            <section className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-[26px] border border-[#334155] bg-[#233143] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 min-h-[420px] flex flex-col justify-center">
                  <div className="text-xs uppercase tracking-[0.22em] text-[#b6c2cf]">
                    Admin Access
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold">
                    Enter 6-digit PIN
                  </h2>

                  <form action={unlockAdmin} className="mt-6 space-y-4">
                    <input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                      required
                    />

                    {error ? (
                      <div className="rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#0f172a]"
                    >
                      Unlock Admin
                    </button>
                  </form>

                  <div className="mt-5 flex justify-center">
                    <a
                      href="/"
                      className="text-sm text-white/70 hover:text-white"
                    >
                      Exit
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#dfe7ee] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-8 py-10 lg:px-12 lg:py-14">
        <div className="mb-6 text-xs font-semibold tracking-[0.24em] text-[#c28a12]">
          RENTFRAY
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <section>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight lg:text-6xl">
              Admin
              <br />
              controls.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#475569]">
              Internal platform access for setup, oversight, and future control
              tools.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-[#eef3f7] p-5 shadow-sm">
                <div className="text-lg font-semibold">Property Setup</div>
                <p className="mt-3 text-sm text-[#475569]">
                  Create and manage property-level system setup.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-[#eef3f7] p-5 shadow-sm">
                <div className="text-lg font-semibold">Platform Controls</div>
                <p className="mt-3 text-sm text-[#475569]">
                  Reserved for internal tools and future admin actions.
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-[26px] border border-[#334155] bg-[#233143] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6 min-h-[320px] flex flex-col justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-[#b6c2cf]">
                    Admin Unlocked
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold">
                    Access granted
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#cbd5e1]">
                    This is your protected admin entry point. We can wire the
                    actual admin controls into this panel next.
                  </p>
                </div>

                <div className="space-y-3">
                  <a
                    href="/"
                    className="block w-full rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-[#0f172a]"
                  >
                    Home
                  </a>

                  <form action={lockAdmin}>
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Lock Admin
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}