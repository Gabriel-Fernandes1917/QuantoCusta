import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/privacidade/", "/calculadora-custo-de-vida/", "/comparar-imoveis/", "/comer-fora-ou-cozinhar/", "/veiculo-proprio-ou-aplicativo/", "/comparar-hospedagens/", "/veiculo-alugado-ou-aplicativo/"].map((path) => ({ url: new URL(path, siteConfig.url).href }));
}
