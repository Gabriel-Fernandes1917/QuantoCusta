import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/privacidade/", "/calculadora-custo-de-vida/"].map((path) => ({ url: new URL(path, siteConfig.url).href }));
}
