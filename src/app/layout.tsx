import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { defaultOpenGraph, siteConfig } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteConfig.url,
  title: { default: `${siteConfig.name} — ${siteConfig.slogan}`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: defaultOpenGraph,
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
        <SiteHeader />
        <main id="conteudo" tabIndex={-1}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
