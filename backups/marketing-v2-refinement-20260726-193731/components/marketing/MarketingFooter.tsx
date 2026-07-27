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
            <strong>Product</strong>
            <button type="button" onClick={() => router.push("/how-it-works")}>
              How it works
            </button>
            <button type="button" onClick={() => router.push("/setup")}>
              Create account
            </button>
            <button type="button" onClick={() => router.push("/property-code")}>
              Sign in
            </button>
          </div>

          <div>
            <strong>Support</strong>
            <button type="button" onClick={() => router.push("/faq")}>
              FAQ
            </button>
            <a href="mailto:helpdesk@rentfray.com">Contact support</a>
            <a href="tel:19363461538">(936) 346-1538</a>
          </div>

          <div>
            <strong>Access</strong>
            <button type="button" onClick={() => router.push("/install")}>
              Install app
            </button>
            <button type="button" onClick={() => router.push("/login/admin")}>
              Admin portal
            </button>
          </div>
        </div>

        <div className="rfm-footer-bottom">
          <span>© 2026 RentFray</span>
          <span>Payments securely processed through Stripe.</span>
        </div>
      </div>
    </footer>
  );
}
