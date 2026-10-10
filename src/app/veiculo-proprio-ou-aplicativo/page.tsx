import type { Metadata } from "next";
import { StructuredData } from "@/components/structured-data";
import { RelatedTools } from "@/components/related-tools";
import { toolStructuredData } from "@/lib/seo";
import { VehicleComparisonCalculator } from "@/components/calculators/vehicle-comparison";
import { pageMetadata, siteConfig } from "@/lib/site-config";
const title = "Carro ou moto próprio ou aplicativo? Compare custos";
const description = "Compare quanto custa ter e usar um carro ou moto com transporte por aplicativo e veja o impacto mensal, anual e o tempo de espera na sua rotina.";
export const metadata: Metadata = pageMetadata(title, description, "/veiculo-proprio-ou-aplicativo/");
export default function VehicleComparisonPage() {
  return <div className="container calculator-page"><StructuredData data={toolStructuredData(title, description, "/veiculo-proprio-ou-aplicativo/")} /><a href="/" className="text-link">← Voltar ao início</a><header className="calculator-heading"><p className="eyebrow">Sua mobilidade, em números</p><h1>Veículo próprio<br /><span>ou aplicativo?</span></h1><p>Descubra qual vale mais a pena na sua rotina.</p></header><VehicleComparisonCalculator reportBrand={{ name: siteConfig.name, domain: siteConfig.reportDomain }} /><section className="calculator-guide"><h2>Como comparar os custos da sua mobilidade</h2><div><h3>Quanto custa manter um carro ou uma moto?</h3><p>Ter o veículo já quitado não elimina IPVA, licenciamento, seguro e manutenção. Separe o custo de possuir do custo de usar: combustível, pedágios e estacionamento. Financiamento ou aluguel/assinatura entram pelo valor mensal informado.</p></div><div><h3>Combustível e corridas na sua rotina</h3><p>Informe seu gasto mensal com combustível ou estime a partir de quilômetros, consumo e preço por litro. Para o aplicativo, informe a frequência semanal e o valor médio por corrida. Os dois cenários usam exclusivamente seus valores, sem preços automáticos.</p></div><div><h3>Dinheiro e tempo, separados</h3><p>Compare os custos mensais e anuais e observe o tempo de espera informado para o aplicativo. Esse tempo não inclui trajetos e não é convertido em dinheiro. A comparação não considera depreciação, compra, revenda ou custo de oportunidade; não recomenda comprar ou vender veículo.</p></div></section><RelatedTools current="/veiculo-proprio-ou-aplicativo/" /></div>;
}
