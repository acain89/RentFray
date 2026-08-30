import type { MetadataRoute } from "next";
import fs from "node:fs";
import path from "node:path";

const siteUrl = "https://www.rentfray.com";

const seoOverhaulLastModified = new Date("2026-08-30T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const marketingDirectory = path.join(process.cwd(), "app", "(marketing)");

  const marketingRoutes = fs
    .readdirSync(marketingDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      fs.existsSync(path.join(marketingDirectory, entry.name, "page.tsx")),
    )
    .map((entry) => entry.name)
    .sort();

  const homepage: MetadataRoute.Sitemap[number] = {
    url: siteUrl,
    lastModified: seoOverhaulLastModified,
    changeFrequency: "weekly",
    priority: 1,
  };

  const marketingPages: MetadataRoute.Sitemap = marketingRoutes.map(
    (route) => ({
      url: `${siteUrl}/${route}`,
      lastModified: seoOverhaulLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    }),
  );

  return [homepage, ...marketingPages];
}
