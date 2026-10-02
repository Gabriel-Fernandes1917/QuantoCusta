import type { Metadata } from "next";
import { defaultOpenGraph, siteConfig } from "@/lib/site-config";
import { CostOfLivingCalculator } from "@/components/calculators/cost-of-living";

const title = "Calculadora de custo de vida para morar sozinho";
const description = "Estime quanto custa morar sozinho: organize renda, moradia, alimentação e outros gastos. Calcule seu saldo mensal com privacidade, no navegador.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/calculadora-custo-de-vida/" },
  openGraph: { ...defaultOpenGraph, title, description, url: "/calculadora-custo-de-vida/" },
};

export default function CostOfLivingPage() {
  return (
    <div className="container calculator-page">
      <a href="/" className="text-link">← Voltar ao início</a>
      <header className="calculator-heading"><p className="eyebrow">Seu mês, mais claro</p><h1>Quanto custaria<br /><span>morar sozinho?</span></h1><p>Imagine seu próximo endereço e coloque as contas no papel. Monte uma estimativa mensal com os seus valores, no seu ritmo.</p></header>
      <CostOfLivingCalculator reportBrand={{ name: siteConfig.name, domain: siteConfig.reportDomain }} />
      <section className="calculator-guide" aria-labelledby="guide-title"><h2 id="guide-title">Como interpretar seu planejamento</h2>
        <div><h3>Uma estimativa da sua vida futura</h3><p>Preencha os gastos que você espera ter ao morar sozinho. Cada seção reúne uma parte da rotina; você pode deixar em branco o que não se aplica.</p></div>
        <div><h3>Dinheiro e VA/VR têm papéis diferentes</h3><p>Salário líquido, renda extra e outras rendas formam sua renda em dinheiro. VA/VR aparece separado. Apenas o uso que você informar em alimentação reduz as despesas pagas em dinheiro, até o limite do benefício e do gasto alimentar.</p></div>
        <div><h3>O que os números mostram</h3><p>O saldo é a renda em dinheiro menos as despesas pagas em dinheiro. O percentual comprometido usa esses mesmos valores; com renda zero, ele não pode ser calculado. A distribuição usa o total de despesas, incluindo benefícios. Percentuais são arredondados para uma casa decimal e podem não somar exatamente 100%.</p></div>
        <div><h3>Veículo próprio e despesas anuais</h3><p>Você pode incluir um carro ou uma moto que já possui ou pretende ter. Seguro, IPVA e licenciamento aceitam valores anuais, divididos por 12 e arredondados para centavos. Ao selecionar “Não”, as despesas do veículo ficam fora dos cálculos e relatórios.</p></div>
        <div><h3>O que esta simulação não considera</h3><p>O custo anual repete o mês estimado 12 vezes; por causa do arredondamento mensal, pode diferir em alguns centavos dos valores anuais originais. Não inclui custos iniciais da mudança, inflação, reajustes ou despesas que você não preencher. Os valores não são comparados com médias de mercado.</p></div>
      </section>
    </div>
  );
}
