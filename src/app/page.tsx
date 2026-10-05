import type { Metadata } from "next";
import { tools, travelTools } from "@/lib/tools";
import { defaultOpenGraph, siteConfig } from "@/lib/site-config";

const title = "QuantoCusta | Entenda o custo real das suas escolhas";
const description = "Use ferramentas gratuitas para comparar custos de moradia, alimentação e mobilidade. Conheça também a área de planejamento de viagens, com ferramentas em breve.";
export const metadata: Metadata = {
  title: { absolute: title }, description,
  alternates: { canonical: "/" },
  openGraph: { ...defaultOpenGraph, title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
};

export default function Home() {
  return (
    <>
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> Sua próxima fase começa com um plano</p>
          <h1 id="hero-title">Quanto custa a vida que <span>você quer?</span></h1>
          <p className="hero-description">Planeje escolhas importantes da sua vida e das suas viagens com ferramentas simples que ajudam você a enxergar o custo real de cada decisão.</p>
          <a href="/calculadora-custo-de-vida/" className="button">Calcular meu custo de vida <span aria-hidden="true">↗</span></a>
          <p className="hero-note">Preço não é necessariamente custo. Compare suas escolhas com os seus números.</p>
          <nav className="planning-shortcuts" aria-label="O que você quer planejar?">
            <p>O que você quer planejar?</p>
            <a href="#vida"><strong>Planejar minha vida <span aria-hidden="true">→</span></strong><span>Moradia, alimentação, mobilidade e organização financeira.</span></a>
            <a href="#viagens"><strong>Planejar uma viagem <span aria-hidden="true">→</span></strong><span>Hospedagem, transporte e voos.</span></a>
          </nav>
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

      <section className="container principles" aria-labelledby="principles-title">
        <div><p className="eyebrow">Feito para a vida real</p><h2 id="principles-title">Suas escolhas.<br />Seus números.<br /><span>Seu ritmo.</span></h2></div>
        <div className="principles-list">
          <div><span aria-hidden="true">01</span><div><h3>Simples de entender</h3><p>Uma proposta direta, com linguagem clara e foco nas perguntas do seu dia a dia.</p></div></div>
          <div><span aria-hidden="true">02</span><div><h3>Planejamento com os seus valores</h3><p>Os cálculos são baseados no que você informar, sem médias inventadas ou promessas financeiras.</p></div></div>
          <div><span aria-hidden="true">03</span><div><h3>Privacidade desde o começo</h3><p>O planejamento é feito no navegador, sem cadastro e sem envio dos valores financeiros para servidores.</p></div></div>
        </div>
      </section>
      <section className="container closing" aria-label="Mensagem do QuantoCusta"><p>Sua próxima escolha <br />começa com <strong>um pouco mais de clareza.</strong></p><span>{siteConfig.name}</span></section>
    </>
  );
}

function ToolCard({ tool }: { tool: { number: string; title: string; tag: string; description: string; href?: string } }) {
  return <article className="tool-card">
    <div className="card-top"><span className="tool-number" aria-hidden="true">{tool.number}</span><span className="badge">{tool.href ? "Disponível" : "Em breve"}</span></div>
    <p className="tool-tag">{tool.tag}</p>
    <h3>{tool.title}</h3>
    <p className="tool-description">{tool.description}</p>
    {tool.href && <a className="text-link" href={tool.href} aria-label={`Abrir ferramenta: ${tool.title}`}>Abrir ferramenta →</a>}
  </article>;
}
