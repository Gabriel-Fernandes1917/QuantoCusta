import type { Metadata } from "next";
import { tools } from "@/lib/tools";
import { defaultOpenGraph, siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { alternates: { canonical: "/" }, openGraph: { ...defaultOpenGraph, url: "/" } };

export default function Home() {
  return (
    <>
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> Sua próxima fase começa com um plano</p>
          <h1 id="hero-title">Quanto custa a vida que <span>você quer?</span></h1>
          <p className="hero-description">Morar sozinho, encontrar seu canto, dar o próximo passo. O QuantoCusta ajuda você a planejar gastos, moradia e independência financeira usando calculadoras simples.</p>
          <a href="/calculadora-custo-de-vida/" className="button">Calcular meu custo de vida <span aria-hidden="true">↗</span></a>
          <p className="hero-note">Comece pelo seu custo de vida. As outras ferramentas estão em preparação.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-sun" />
          <div className="art-window"><span /><span /><span /><span /></div>
          <div className="art-home"><div className="art-roof" /><div className="art-door" /><div className="art-home-window" /></div>
          <div className="art-plant"><div className="leaf leaf-one" /><div className="leaf leaf-two" /><div className="leaf leaf-three" /><div className="plant-pot" /></div>
          <div className="art-ground" />
          <p className="art-caption">Um plano de cada vez.<br /><strong>Uma vida mais sua.</strong></p>
        </div>
      </section>

      <section id="ferramentas" className="tools-section" aria-labelledby="tools-title">
        <div className="container">
          <div className="section-heading"><div><p className="eyebrow">Do primeiro plano à casa nova</p><h2 id="tools-title">Menos dúvidas.<br />Mais clareza nas contas.</h2></div><p>Quatro ferramentas para transformar perguntas grandes em próximos passos possíveis.</p></div>
          <div className="tools-grid">
            {tools.map((tool) => (
              <article className="tool-card" key={tool.number}>
                <div className="card-top"><span className="tool-number" aria-hidden="true">{tool.number}</span><span className="badge">{"href" in tool ? "Disponível" : "Em breve"}</span></div>
                <p className="tool-tag">{tool.tag}</p>
                <h3>{tool.title}</h3>
                <p className="tool-description">{tool.description}</p>
                {"href" in tool && <a className="text-link" href={tool.href}>Abrir calculadora →</a>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container principles" aria-labelledby="principles-title">
        <div><p className="eyebrow">Feito para a vida real</p><h2 id="principles-title">Suas escolhas.<br />Seus números.<br /><span>Seu ritmo.</span></h2></div>
        <div className="principles-list">
          <div><span aria-hidden="true">01</span><div><h3>Simples de entender</h3><p>Uma proposta direta, com linguagem clara e foco nas perguntas do seu dia a dia.</p></div></div>
          <div><span aria-hidden="true">02</span><div><h3>Planejamento com os seus valores</h3><p>Os cálculos são baseados no que você informar, sem médias inventadas ou promessas financeiras.</p></div></div>
          <div><span aria-hidden="true">03</span><div><h3>Privacidade desde o começo</h3><p>O planejamento é feito no navegador, sem cadastro e sem envio dos valores financeiros para servidores.</p></div></div>
        </div>
      </section>
      <section className="container closing" aria-label="Mensagem do QuantoCusta"><p>O próximo capítulo da sua vida<br />começa com <strong>um pouco mais de clareza.</strong></p><span>{siteConfig.name}</span></section>
    </>
  );
}
