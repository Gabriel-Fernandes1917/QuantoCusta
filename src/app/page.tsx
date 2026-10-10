import type { Metadata } from "next";
import { HomeFeedback } from "@/components/home-feedback";
import { DecisionIllustration } from "@/components/decision-illustration";
import { tools, travelTools } from "@/lib/tools";
import { defaultOpenGraph, siteConfig } from "@/lib/site-config";
import { StructuredData } from "@/components/structured-data";
import { websiteStructuredData } from "@/lib/seo";

const title = "Coyler — Compare custos e tome decisões melhores";
const description = "Compare moradia, alimentação, transporte e viagens. Descubra custos que passam despercebidos e tome decisões com mais clareza usando ferramentas gratuitas.";
export const metadata: Metadata = {
  title: { absolute: title }, description,
  alternates: { canonical: "/" },
  openGraph: { ...defaultOpenGraph, title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
};

export default function Home() {
  return (
    <>
      <StructuredData data={websiteStructuredData} />
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> Escolhas mais claras começam aqui</p>
          <h1 id="hero-title">O menor preço nem sempre é <span>o menor custo.</span></h1>
          <p className="hero-description">{siteConfig.heroDescription}</p>
          <a href="#ferramentas" className="button">Explorar ferramentas <span aria-hidden="true">↗</span></a>
          <p className="hero-note">Preço não é necessariamente custo.</p>
          <nav className="planning-shortcuts" aria-label="O que você quer planejar?">
            <p>O que você quer planejar?</p>
            <a href="#vida"><strong>Planejar minha vida <span aria-hidden="true">→</span></strong><span>Moradia, alimentação, mobilidade e organização financeira.</span></a>
            <a href="#viagens"><strong>Planejar uma viagem <span aria-hidden="true">→</span></strong><span>Hospedagem, deslocamentos e custos da viagem.</span></a>
          </nav>
        </div>
        <DecisionIllustration />
      </section>

      <section className="container choice-examples" aria-labelledby="examples-title">
        <h2 id="examples-title">Nem sempre a primeira conta mostra tudo.</h2>
        <p>Algumas escolhas envolvem gastos que só aparecem quando você olha o cenário completo.</p>
        <div className="examples-grid">
          {[
            ["⌂", "Um aluguel menor", "Pode trazer mais gastos com deslocamento."],
            ["♨", "Comida feita em casa", "Pode ter uma diferença menor do que você imagina."],
            ["↔", "Um carro alugado", "Pode custar mais do que o valor anunciado na locadora."],
            ["◇", "Uma hospedagem mais cara", "Pode economizar transporte e alimentação."],
          ].map(([icon, heading, text]) => <article className="example-card" key={heading}><span aria-hidden="true">{icon}</span><h3>{heading}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <div id="ferramentas">
        <section id="vida" className="tools-section life-section" aria-labelledby="tools-title">
          <div className="container">
            <div className="section-heading"><div><p className="eyebrow">Planeje sua vida</p><h2 id="tools-title">Menos dúvidas.<br />Mais clareza nas contas.</h2></div><p>Ferramentas para transformar perguntas grandes em próximos passos possíveis.</p></div>
            <div className="tools-grid">
              {tools.map(tool => <ToolCard key={tool.number} tool={tool} />)}
            </div>
          </div>
        </section>

        <section id="viagens" className="tools-section travel-section" aria-labelledby="travel-title">
          <div className="container">
            <div className="section-heading"><div><p className="eyebrow">Planeje suas viagens</p><h2 id="travel-title">Viaje com mais clareza nas contas.</h2></div><p>Compare o custo real das escolhas da sua viagem e descubra quando a opção mais barata pode não ser a mais econômica.</p></div>
            <div className="tools-grid">
              {travelTools.map(tool => <ToolCard key={tool.number} tool={tool} />)}
            </div>
          </div>
        </section>

      </div>

      <section className="container principles" aria-labelledby="principles-title">
        <div><p className="eyebrow">Feito para a vida real</p><h2 id="principles-title">Suas escolhas.<br />Seus números.<br /><span>Seu ritmo.</span></h2></div>
        <div className="principles-list">
          <div><span aria-hidden="true">01</span><div><h3>Simples de entender</h3><p>Uma proposta direta, com linguagem clara e foco nas perguntas do seu dia a dia.</p></div></div>
          <div><span aria-hidden="true">02</span><div><h3>Planejamento com os seus valores</h3><p>Os cálculos são baseados no que você informar, sem médias inventadas ou promessas financeiras.</p></div></div>
          <div><span aria-hidden="true">03</span><div><h3>Privacidade desde o começo</h3><p>O planejamento é feito no navegador, sem cadastro e sem envio dos valores financeiros para servidores.</p></div></div>
        </div>
      </section>
      <HomeFeedback />
      <section className="container closing" aria-label="Mensagem da Coyler"><p>Sua próxima escolha <br />começa com <strong>um pouco mais de clareza.</strong></p><span>{siteConfig.name}</span></section>
    </>
  );
}

function ToolCard({ tool }: { tool: { number: string; title: string; tag: string; description: string; href?: string } }) {
  const className = `tool-card${tool.href === "/custo-da-viagem/" ? " trip-featured" : ""}`;
  const content = <>
    <div className="card-top"><span className="tool-number" aria-hidden="true">{tool.number}</span><span className="badge">{tool.href ? "Disponível" : "Em breve"}</span></div>
    <p className="tool-tag">{tool.tag}</p>
    <h3>{tool.title}</h3>
    <p className="tool-description">{tool.description}</p>
    {tool.href && <span className="text-link">Abrir ferramenta →</span>}
  </>;
  return tool.href
    ? <a className={className} href={tool.href} aria-label={`Abrir ferramenta: ${tool.title}`}>{content}</a>
    : <article className={className}>{content}</article>;
}
