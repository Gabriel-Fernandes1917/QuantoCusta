import { siteConfig } from "@/lib/site-config";
import { ThemeSelector } from "@/components/theme-selector";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="/" className="brand" aria-label={`${siteConfig.name} — início`}>
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M23 9a10 10 0 1 0 0 14" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><circle cx="24" cy="16" r="2.5" fill="currentColor"/></svg></span>
          <span className="brand-wordmark">coyler.</span>
        </a>
        <ThemeSelector />
        <nav aria-label="Navegação principal">
          <a className="nav-link" href="/#vida">Vida</a>
          <a className="nav-link" href="/#viagens">Viagens</a>
          <a className="nav-link" href="/privacidade/">Privacidade</a>
        </nav>
      </div>
    </header>
  );
}
