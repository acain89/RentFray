"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";

export default function AnalyticsTags() {
  const pathname = usePathname();
  if (process.env.NODE_ENV !== "production" || !pathname ||
      pathname === "/login/manager/forgot-password" || pathname === "/login/manager/reset-password") return null;
  return <>
    <Script src="https://www.googletagmanager.com/gtag/js?id=G-PZ5HJJNRTS" strategy="afterInteractive" />
    <Script id="google-tags" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-PZ5HJJNRTS');
      gtag('config', 'AW-18311599021');
    `}</Script>
  </>;
}
