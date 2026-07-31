"use client";

import { useRouter } from "next/navigation";
import BrandMark from "./BrandMark";

export default function MarketingFooter() {
  const router = useRouter();

  return (
    <footer className="rfm-footer">
      <div className="rfm-container">
        <div className="rfm-footer-grid">
          <div>
            <BrandMark />
            <p>Rent collection that makes sense for independent property owners.</p>
          </div>
          <div>
            <strong>Learn</strong>
            <button type="button" onClick={() => router.push("/how-it-works")}>How it works</button>
            <button type="button" onClick={() => router.push("/pricing")}>Pricing</button>
            <button type="button" onClick={() => router.push("/security-payments")}>Security & payments</button>
          </div>
          <div>
            <strong>About</strong>
            <button
  type="button"
  className="rfm-footer-feature-link"
  onClick={() => router.push("/why-rentfray")}
>
  Why Switch?
</button>
            <button type="button" onClick={() => router.push("/is-rentfray-right-for-me")}>Is RentFray right for me?</button>
            <button type="button" onClick={() => router.push("/faq")}>FAQ</button>
          </div>
          <div>
            <strong>Access</strong>
            <button type="button" onClick={() => router.push("/setup")}>Create Account</button>
            <button type="button" onClick={() => router.push("/property-code")}>Sign In</button>
            <a href="mailto:helpdesk@rentfray.com">Contact support</a>
          </div>
        </div>
        <div className="rfm-footer-bottom">
          <span>(c) 2026 RentFray</span>
          <span>Payments securely processed through Stripe.</span>
        </div>
      </div>
    </footer>
  );
}

