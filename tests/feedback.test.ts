import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeFeedback } from "../src/components/home-feedback";

describe("contato voluntário por e-mail",()=>{
  it("preserva endereço, mensagens e codificação ao solicitar novo contexto",()=>{
    const html=renderToStaticMarkup(createElement(HomeFeedback));
    const links=[...html.matchAll(/<a[^>]+href="(mailto:[^"]+)"[^>]*>/g)];
    expect(links).toHaveLength(2);
    for(const [index,match] of links.entries()){
      expect(match[0]).toContain('target="_blank"');expect(match[0]).toContain('rel="noopener noreferrer"');
      const url=new URL(match[1].replaceAll("&amp;","&"));expect(url.pathname).toBe("gabgui2001@gmail.com");
      expect(url.searchParams.get("subject")).toBe(index===0?"[Coyler] Sugestão de ferramenta":"[Coyler] Relato de problema");
      const body=url.searchParams.get("body")!;expect(body).toMatch(/^Olá!\r\n\r\n/);expect(body).toContain(index===0?"Qual decisão essa ferramenta ajudaria a tomar?":"O que você esperava que acontecesse?");
      expect(body).toContain(index===0?"[Descreva sua sugestão aqui]":"[Descreva o problema]");
    }
    expect(html).toContain("Copiar e-mail");expect(html).toContain("revisar e enviar");expect(html).not.toContain("E-mail copiado.");
  });
});
