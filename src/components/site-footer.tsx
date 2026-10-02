import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div><p className="footer-brand">{siteConfig.name}</p><p>Mais clareza para o seu próximo passo.</p></div>
        <a href="/privacidade/" className="text-link">Privacidade</a>
      </div>
      <p className="container disclaimer">Os resultados apresentados são estimativas baseadas exclusivamente nos valores informados pelo usuário e possuem caráter informativo. Eles não constituem recomendação financeira.</p>
    </footer>
  );
}
