"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import MarketingNavigation from "./MarketingNavigation";
import MarketingFooter from "./MarketingFooter";

export default function MarketingPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <main className="rfp-page">
      <MarketingNavigation />
      <section className="rfp-hero">
        <div className="rfm-container">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </section>

      {children}

      <section className="rfp-cta">
        <div className="rfm-container">
          <h2>Ready to make rent collection simpler?</h2>
          <p>Create your account and start setting up today.</p>
          <button type="button" onClick={() => router.push("/setup")}>Create Account</button>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}

