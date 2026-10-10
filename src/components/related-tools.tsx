import { tools, travelTools } from "@/lib/tools";

const related: Record<string, string[]> = {
  "/calculadora-custo-de-vida/": ["/comparar-imoveis/", "/comer-fora-ou-cozinhar/", "/veiculo-proprio-ou-aplicativo/"],
  "/comparar-imoveis/": ["/calculadora-custo-de-vida/", "/veiculo-proprio-ou-aplicativo/"],
  "/comer-fora-ou-cozinhar/": ["/calculadora-custo-de-vida/"],
  "/veiculo-proprio-ou-aplicativo/": ["/calculadora-custo-de-vida/", "/comparar-imoveis/"],
  "/comparar-hospedagens/": ["/custo-da-viagem/", "/veiculo-alugado-ou-aplicativo/"],
  "/veiculo-alugado-ou-aplicativo/": ["/custo-da-viagem/", "/comparar-hospedagens/"],
  "/custo-da-viagem/": ["/comparar-hospedagens/", "/veiculo-alugado-ou-aplicativo/"],
};
export function RelatedTools({ current }: { current: string }) {
  const suggestions = [...tools, ...travelTools].filter(tool => related[current]?.includes(tool.href));
  return <section className="related-tools" aria-labelledby="related-title">
    <h2 id="related-title">Continue seu planejamento</h2>
    <p>Detalhe outros gastos com as ferramentas gratuitas da Coyler. A transferência de valores é manual.</p>
    <ul>{suggestions.map(tool => <li key={tool.href}><a className="text-link" href={tool.href}>{tool.title} →</a></li>)}</ul>
  </section>;
}
