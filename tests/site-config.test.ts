import { describe, expect, it } from "vitest";
import { pageMetadata, publicPaths, resolveSiteUrl, siteConfig } from "../src/lib/site-config";

describe("domínio usado no SEO", () => {
  it("prepara o domínio planejado da Coyler sem depender de configuração externa", () => {
    expect(resolveSiteUrl().href).toBe("https://coyler.com.br/");
    expect(siteConfig.name).toBe("Coyler");
  });
  it("permite uma origem local explicitamente configurada para desenvolvimento", () => {
    expect(resolveSiteUrl("http://localhost:3000").href).toBe("http://localhost:3000/");
  });
  it("produz metadados específicos e consistentes em cada página", () => {
    const metadata = pageMetadata("Calculadora", "Descrição específica", "/custo-da-viagem/");
    expect(metadata.alternates?.canonical).toBe("/custo-da-viagem/");
    expect(metadata.openGraph).toMatchObject({ title: "Calculadora | Coyler", description: "Descrição específica", locale: "pt_BR", url: "/custo-da-viagem/" });
    expect(metadata.twitter).toMatchObject({ title: "Calculadora | Coyler", description: "Descrição específica", card: "summary_large_image" });
    expect(new Set(publicPaths).size).toBe(9);
  });
  it("resolve canonical e sitemap com um domínio de produção", () => {
    const base = resolveSiteUrl("https://coyler.example");
    expect(new URL("/privacidade/", base).href).toBe("https://coyler.example/privacidade/");
  });
  it.each(["javascript:alert(1)", "https://user:password@example.com", "https://example.com/subpasta", "https://example.com/?x=1", "https://example.com/#x", "dominio-invalido"])("rejeita uma configuração inadequada: %s", (value) => {
    expect(() => resolveSiteUrl(value)).toThrow();
  });
});
