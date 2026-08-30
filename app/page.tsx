import type { Metadata } from "next";

import HomePage from "@/components/marketing/HomePage";
import "./marketing.css";

const pageTitle = "RentFray | Free Rent Collection Software";

const pageDescription =
  "Free rent collection software for property owners and managers. Collect rent online, track tenant balances and payment status, and accept secure payments without monthly software fees.";

export const metadata: Metadata = {
  title: {
    absolute: pageTitle,
  },
  description: pageDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "RentFray",
    title: pageTitle,
    description:
      "Collect rent online, track balances and payment status, and manage rent collection without monthly software fees.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Free online rent collection software for property owners and managers.",
  },
};

export default function Home() {
  return <HomePage />;
}