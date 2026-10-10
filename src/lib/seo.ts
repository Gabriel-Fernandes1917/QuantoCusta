import { siteConfig } from "./site-config";

export const websiteStructuredData = {
  "@context": "https://schema.org", "@type": "WebSite",
  "@id": new URL("/#website", siteConfig.url).href,
  name: siteConfig.name, url: siteConfig.url.href, description: siteConfig.description, inLanguage: "pt-BR",
};
export function toolStructuredData(name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org", "@type": "WebApplication",
    name, description, url: new URL(path, siteConfig.url).href,
    applicationCategory: "FinanceApplication", operatingSystem: "Any", inLanguage: "pt-BR",
    isAccessibleForFree: true, browserRequirements: "Requer JavaScript para calcular no navegador.",
    isPartOf: { "@id": websiteStructuredData["@id"] },
  };
}
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
