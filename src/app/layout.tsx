import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { defaultOpenGraph, siteConfig } from "@/lib/site-config";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteConfig.url,
  title: { default: `${siteConfig.name} — ${siteConfig.slogan}`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: defaultOpenGraph,
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
  icons: { icon: [{ url: "/icon-32.png", sizes: "32x32", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body>
        <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
        <SiteHeader />
        <main id="conteudo" tabIndex={-1}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
