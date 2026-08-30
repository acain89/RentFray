import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/manager/",
          "/tenant/",
          "/setup/",
        ],
      },
    ],
    sitemap: "https://www.rentfray.com/sitemap.xml",
    host: "https://www.rentfray.com",
  };
}