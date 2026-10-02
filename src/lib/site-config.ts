export function resolveSiteUrl(value = "http://localhost:3000"): URL {
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
  name: "QuantoCusta",
  slogan: "Quanto custa a vida que você quer?",
  description: "Planeje gastos, moradia e independência financeira com calculadoras simples. Conheça o QuantoCusta e prepare seus próximos passos.",
  url: siteUrl,
  reportDomain: process.env.REPORT_DOMAIN ?? (siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1" ? "" : siteUrl.hostname),
};

export const defaultOpenGraph = {
  type: "website" as const,
  locale: "pt_BR",
  siteName: siteConfig.name,
  title: siteConfig.slogan,
  description: siteConfig.description,
  images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "QuantoCusta — Quanto custa a vida que você quer?" }],
};
