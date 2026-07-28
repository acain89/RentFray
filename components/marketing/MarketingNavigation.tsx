"use client";

import { useRouter } from "next/navigation";
import BrandMark from "./BrandMark";

export default function MarketingNavigation() {
  const router = useRouter();

  return (
    <header className="rfm-header">
      <div className="rfm-container rfm-nav">
        <button type="button" className="rfm-logo-button" onClick={() => router.push("/")} aria-label="RentFray home">
          <BrandMark />
        </button>

        <nav className="rfm-nav-links" aria-label="Main navigation">
          <button type="button" onClick={() => router.push("/how-it-works")}>How it works</button>
          <button type="button" onClick={() => router.push("/pricing")}>Pricing</button>
          <button
  type="button"
  onClick={() => router.push("/security-payments")}
>
  Security & Payments
</button>
          <button type="button" onClick={() => router.push("/why-rentfray")}>Why RentFray</button>
        </nav>

        <div className="rfm-nav-actions">
  <button
    type="button"
    className="rfm-signin-button"
    onClick={() => router.push("/property-code")}
  >
    Sign In
  </button>

  <button
    type="button"
    className="rfm-signin-button"
    onClick={() => router.push("/login/admin")}
  >
    Admin
  </button>

  <button
    type="button"
    className="rfm-button rfm-button-small"
    onClick={() => router.push("/setup")}
  >
    Create Account
  </button>
</div>
     </div>
    </header>
  );
}
