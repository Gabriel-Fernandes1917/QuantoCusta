import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "../src/lib/site-config";

describe("domínio usado no SEO", () => {
  it("usa localhost somente como fallback de desenvolvimento", () => {
    expect(resolveSiteUrl().href).toBe("http://localhost:3000/");
  });
  it("resolve canonical e sitemap com um domínio de produção", () => {
    const base = resolveSiteUrl("https://quantocusta.example");
    expect(new URL("/privacidade/", base).href).toBe("https://quantocusta.example/privacidade/");
  });
  it.each(["javascript:alert(1)", "https://user:password@example.com", "https://example.com/subpasta", "https://example.com/?x=1", "https://example.com/#x", "dominio-invalido"])("rejeita uma configuração inadequada: %s", (value) => {
    expect(() => resolveSiteUrl(value)).toThrow();
  });
});
