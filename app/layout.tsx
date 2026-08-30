import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import PwaServiceWorker from "./components/PwaServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rentfray.com"),

  title: {
    default: "RentFray | Free Rent Collection Software",
    template: "%s | RentFray",
  },

  description:
    "Free rent collection software for property owners and managers. Collect rent online, track tenant balances and payment status, and accept secure payments without monthly software fees.",

  keywords: [
    "rent collection software",
    "free rent collection software",
    "online rent collection",
    "collect rent online",
    "rent payment software",
    "landlord rent collection",
    "property management rent collection",
    "ACH rent payments",
    "online rent payments",
    "rent collection for landlords",
  ],

  applicationName: "RentFray",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    url: "/",
    siteName: "RentFray",
    title: "RentFray | Free Rent Collection Software",
    description:
      "Collect rent online, track balances and payment status, and manage rent collection without monthly software fees.",
  },

  twitter: {
    card: "summary_large_image",
    title: "RentFray | Free Rent Collection Software",
    description:
      "Free online rent collection software for property owners and managers.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const rentFraySchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.rentfray.com/#organization",
      name: "RentFray",
      url: "https://www.rentfray.com",
      description:
        "RentFray provides free rent collection software for property owners and managers.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.rentfray.com/#software",
      name: "RentFray",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://www.rentfray.com",
      description:
        "Free rent collection software for property owners and managers to collect rent online, track balances, and monitor payment status.",
      publisher: {
        "@id": "https://www.rentfray.com/#organization",
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "No monthly software fee for property owners and managers.",
      },
      featureList: [
        "Online rent collection",
        "Tenant balance tracking",
        "Payment status tracking",
        "Recurring rent management",
        "Secure payment processing through Stripe",
      ],
    },
  ],
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-PZ5HJJNRTS"
          strategy="afterInteractive"
        />

        <Script id="google-tags" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-PZ5HJJNRTS');
            gtag('config', 'AW-18311599021');
          `}
        </Script>

<Script
  id="rentfray-structured-data"
  type="application/ld+json"
  strategy="beforeInteractive"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(rentFraySchema),
  }}
/>

        <PwaServiceWorker />
        {children}
      </body>
    </html>
  );
}