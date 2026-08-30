import type { MetadataRoute } from "next";
import { readdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://www.rentfray.com";

async function getMarketingRoutes(): Promise<string[]> {
  const marketingDirectory = path.join(
    process.cwd(),
    "app",
    "(marketing)",
  );

  const entries = await readdir(marketingDirectory, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/${entry.name}`)
    .sort();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const marketingRoutes = await getMarketingRoutes();

  const routes = ["/", ...marketingRoutes];

return routes.map((route) => ({
  url: `${BASE_URL}${route}`,
  changeFrequency: route === "/" ? "weekly" : "monthly",
  priority: route === "/" ? 1 : 0.8,
}));
}