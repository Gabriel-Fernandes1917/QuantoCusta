import type { Metadata } from "next";
import { defaultOpenGraph } from "@/lib/site-config";

const description = "Entenda a privacidade no QuantoCusta, o funcionamento previsto das calculadoras e quais dados a hospedagem pode processar.";
export const metadata: Metadata = { title: "Privacidade", description, alternates: { canonical: "/privacidade/" }, openGraph: { ...defaultOpenGraph, title: "Privacidade | QuantoCusta", description, url: "/privacidade/" } };

export default function PrivacyPage() {
  return (
    <article className="container privacy-page">
      <a href="/" className="text-link">← Voltar ao início</a>
      <p className="eyebrow">Transparência, sem complicação</p>
      <h1>Privacidade</h1>
      <p className="privacy-lead">Seu planejamento financeiro é pessoal. Aqui você encontra o que o QuantoCusta faz hoje e como as futuras ferramentas vão tratar seus dados.</p>
      <p className="updated">Última atualização: <time dateTime="2026-10-01">1 de outubro de 2026</time>.</p>
      <section><h2>O que está disponível agora</h2><p>Esta versão apresenta o portal e as ferramentas planejadas. Ainda não há calculadoras, formulários financeiros, cadastro ou login. Não solicitamos nem armazenamos valores financeiros nesta etapa.</p></section>
      <section><h2>Cálculos no seu navegador</h2><p>Quando disponibilizadas, as calculadoras farão os cálculos no próprio navegador. Os valores financeiros preenchidos não serão enviados para servidores ou bancos de dados.</p></section>
      <section><h2>Salvamento local opcional</h2><p>O salvamento de simulações ainda não está disponível. Nas futuras calculadoras, você poderá escolher salvar os dados apenas neste navegador, usando o armazenamento local chamado localStorage.</p><p>Esse recurso não sincronizará dados entre dispositivos. Haverá uma opção para limpar os dados salvos pelo QuantoCusta. Quem tiver acesso ao mesmo navegador poderá ter acesso às simulações armazenadas.</p></section>
      <section><h2>Dados técnicos da hospedagem</h2><p>Ao acessar um site, o serviço de hospedagem pode processar dados técnicos, como endereço IP, navegador, páginas solicitadas e registros de acesso, para entregar o conteúdo e operar o serviço. Isso depende da plataforma usada no deploy e de suas configurações.</p><p>Por isso, não afirmamos que nenhum dado técnico é coletado. Os detalhes da plataforma de hospedagem deverão ser incluídos aqui quando ela for definida.</p></section>
      <section><h2>Cookies, métricas e publicidade</h2><p>O código desta versão não inclui ferramentas de Analytics, publicidade, rastreamento ou cookies próprios. Se esses serviços forem adicionados, esta página será atualizada para explicar seu funcionamento e os controles aplicáveis.</p></section>
      <section><h2>Atualizações desta página</h2><p>Esta página acompanhará a evolução do produto. A data acima indicará a última revisão, e mudanças relevantes no tratamento de dados serão descritas aqui.</p></section>
    </article>
  );
}
