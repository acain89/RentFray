import type { Metadata } from "next";

import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import {
  DetailCard,
  DetailSection,
} from "@/components/marketing/MarketingDetails";
import "../marketing-pages.css";

export const metadata: Metadata = {
  title: "Property Maintenance Request Portal | RentFray",
  description:
    "RentFray includes a built-in maintenance request portal where tenants can report issues and managers and maintenance personnel can track progress.",
  alternates: {
    canonical: "/maintenance",
  },
  openGraph: {
    type: "website",
    url: "/maintenance",
    siteName: "RentFray",
    title: "Property Maintenance Request Portal | RentFray",
    description:
      "Keep tenant maintenance requests organized and visible through RentFray.",
  },
};

const maintenanceSteps = [
  [
    "01",
    "Tenant reports the issue",
    "Tenants submit maintenance requests directly from their RentFray portal with details about the problem.",
  ],
  [
    "02",
    "The request becomes visible",
    "Managers can see submitted requests, while maintenance personnel can access the requests available to them.",
  ],
  [
    "03",
    "Progress is updated",
    "Maintenance activity and request status can be updated as work moves forward.",
  ],
  [
    "04",
    "Management stays informed",
    "Managers can follow maintenance activity without relying on separate paper notes or disconnected tracking.",
  ],
] as const;

export default function MaintenancePage() {
  return (
    <MarketingPageShell
      eyebrow="Built-in maintenance portal"
      title={
        <>
          Maintenance requests.
          <br />
          Organized in one place.
        </>
      }
      intro="Rent collection is RentFray's primary job. The built-in maintenance portal gives tenants, managers, and maintenance personnel a simple way to keep property issues organized too."
    >
      <DetailSection
        eyebrow="How it works"
        title="From tenant report to completed work."
        text="Tenants can report an issue through RentFray, and the people responsible for the property can follow the request as it moves forward."
      >
        <div className="rfp-grid-four">
          {maintenanceSteps.map(([number, title, text]) => (
            <DetailCard
              key={number}
              number={number}
              title={title}
              text={text}
            />
          ))}
        </div>
      </DetailSection>

      <DetailSection
        eyebrow="For tenants"
        title="Report the problem without tracking someone down."
        text="Tenants can submit maintenance requests through their RentFray portal instead of relying on a phone call, paper note, or separate maintenance system."
        dark
      />

      <DetailSection
        eyebrow="For management"
        title="Keep requests visible."
        text="Managers can review maintenance activity and follow request status from RentFray, keeping another part of property operations connected to the tenant account."
      />

      <DetailSection
        eyebrow="For maintenance personnel"
        title="A dedicated place to see what needs attention."
        text="Maintenance personnel have their own RentFray access so maintenance work does not need to be managed through the rent-collection dashboard."
      />

      <DetailSection
        eyebrow="Included with RentFray"
        title="A useful extra. Not another subscription."
        text="The maintenance portal is included as part of RentFray. Property owners and managers do not pay a monthly software fee to use RentFray."
      />
    </MarketingPageShell>
  );
}
