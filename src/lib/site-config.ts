import type { Metadata } from "next";
import { tools, travelTools } from "./tools";

export const PLANNED_SITE_URL = "https://coyler.com.br";
export function resolveSiteUrl(value = PLANNED_SITE_URL): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("SITE_URL deve ser uma URL pública HTTP ou HTTPS, sem credenciais.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SITE_URL deve conter apenas o domínio, sem caminho, query ou fragmento.");
  }
  return url;
}

const siteUrl = resolveSiteUrl(process.env.SITE_URL);

export const siteConfig = {
  name: "Coyler",
  slogan: "O menor preço nem sempre é o menor custo.",
  heroDescription: "Enxergue além do preço. Compare todos os custos envolvidos em suas escolhas e descubra o que realmente compensa para você.",
  description: "Compare moradia, alimentação, transporte e viagens. Descubra custos que passam despercebidos e tome decisões com mais clareza usando ferramentas gratuitas.",
  url: siteUrl,
  reportDomain: process.env.REPORT_DOMAIN ?? (siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1" ? "" : siteUrl.hostname),
};

export const defaultOpenGraph = {
  type: "website" as const,
  locale: "pt_BR",
  siteName: siteConfig.name,
  title: siteConfig.slogan,
  description: siteConfig.description,
  images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Coyler" }],
};

export const publicPaths = ["/", "/privacidade/", ...tools.map(tool => tool.href), ...travelTools.map(tool => tool.href)];

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const brandedTitle = `${title} | ${siteConfig.name}`;
  return {
    title, description, alternates: { canonical: path },
    openGraph: { ...defaultOpenGraph, title: brandedTitle, description, url: path },
    twitter: { card: "summary_large_image", title: brandedTitle, description, images: ["/og-image.png"] },
  };
}
