import type { MetadataRoute } from "next";
import { publicPaths, siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({ url: new URL(path, siteConfig.url).href }));
}
