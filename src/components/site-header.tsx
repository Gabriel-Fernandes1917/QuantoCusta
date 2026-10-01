import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="/" className="brand" aria-label={`${siteConfig.name} — início`}>
          <span className="brand-mark" aria-hidden="true">q.</span>
          {siteConfig.name}
        </a>
        <nav aria-label="Navegação principal">
          <a className="nav-link" href="/#ferramentas">Ferramentas</a>
          <a className="nav-link" href="/privacidade/">Privacidade</a>
        </nav>
      </div>
    </header>
  );
}
