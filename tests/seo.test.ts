import { describe, expect, it } from "vitest";
import { serializeJsonLd, toolStructuredData, websiteStructuredData } from "../src/lib/seo";
import { publicPaths, siteConfig } from "../src/lib/site-config";

describe("dados estruturados verdadeiros e seguros", () => {
  it("identifica a Coyler como website em português", () => {
    expect(websiteStructuredData).toMatchObject({ "@type": "WebSite", name: "Coyler", inLanguage: "pt-BR", url: siteConfig.url.href });
  });
  it.each(publicPaths.filter(path => path !== "/" && path !== "/privacidade/"))("descreve a ferramenta %s sem avaliações inventadas", path => {
    const data = toolStructuredData("Calculadora", "Compare valores informados", path);
    expect(data).toMatchObject({ "@type": "WebApplication", url: new URL(path, siteConfig.url).href, isAccessibleForFree: true });
    expect(data).not.toHaveProperty("aggregateRating"); expect(data).not.toHaveProperty("review");
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
  it("escapa encerramento de script sem modificar o conteúdo JSON", () => {
    const data = { name: "</script><script>alert(1)</script>" }, json = serializeJsonLd(data);
    expect(json).not.toContain("<"); expect(JSON.parse(json)).toEqual(data);
  });
  it("mantém exatamente a mensagem aprovada da Home", () => {
    expect(siteConfig.slogan).toBe("O menor preço nem sempre é o menor custo.");
    expect(siteConfig.heroDescription).toBe("Enxergue além do preço. Compare todos os custos envolvidos em suas escolhas e descubra o que realmente compensa para você.");
  });
});
