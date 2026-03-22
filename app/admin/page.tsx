// app/admin/page.tsx

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

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

type AdminPageSearchParams = Promise<{
  error?: string;
  saved?: string;
}>;

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: AdminPageSearchParams;
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

  const savedMessage =
    params.saved === "draft" ? "Your setup draft was saved." : "";

  if (!unlocked) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.lockCard}>
            <div className={styles.lockInner}>
              <div className={styles.lockHeader}>
                <p className={styles.eyebrow}>Admin Access</p>
                <h1 className={styles.title}>Enter your PIN</h1>
                <p className={styles.subtitle}>
                  Use your 6-digit admin PIN to open the RentFray admin area.
                </p>
              </div>

              <form action={unlockAdmin} className={styles.form}>
                <div>
                  <label htmlFor="pin" className={styles.label}>
                    6-digit PIN
                  </label>
                  <input
                    id="pin"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    autoComplete="current-password"
                    className={styles.pinInput}
                    required
                  />
                </div>

                {error ? (
                  <div className={styles.errorBox}>{error}</div>
                ) : null}

                <button type="submit" className={styles.primaryButton}>
                  Continue
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hubCard}>
          <div className={styles.hubInner}>
            <div className={styles.hubHeader}>
              <p className={styles.eyebrow}>Admin</p>
              <h1 className={styles.title}>RentFray control center</h1>
              <p className={styles.subtitle}>
                Create new properties or open existing ones to manage pricing,
                tiers, units, charges, rules, and status.
              </p>
            </div>

            {savedMessage ? (
              <div className={styles.successBox}>{savedMessage}</div>
            ) : null}

            <div className={styles.actionGrid}>
              <Link href="/admin/properties/new" className={styles.primaryAction}>
                <span className={styles.actionTitle}>Create New Property</span>
                <span className={styles.actionText}>
                  Open the 6-step setup wizard.
                </span>
              </Link>

              <Link href="/admin/properties" className={styles.secondaryAction}>
                <span className={styles.actionTitle}>Manage Existing Properties</span>
                <span className={styles.actionText}>
                  View and edit current property accounts.
                </span>
              </Link>
            </div>

            <form action={lockAdmin} className={styles.lockForm}>
              <button type="submit" className={styles.lockButton}>
                Lock
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}