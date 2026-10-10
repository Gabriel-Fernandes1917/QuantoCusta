import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site-config";

const description = "Saiba como a Coyler calcula no navegador, salva simulações e preferências de tema localmente e gera relatórios sem enviar dados financeiros.";
export const metadata: Metadata = pageMetadata("Privacidade", description, "/privacidade/");

export default function PrivacyPage() {
  return (
    <article className="container privacy-page">
      <a href="/" className="text-link">← Voltar ao início</a>
      <p className="eyebrow">Transparência, sem complicação</p>
      <h1>Privacidade</h1>
      <p className="privacy-lead">Seu planejamento financeiro é pessoal. Aqui você encontra como a Coyler trata os dados da sua simulação.</p>
      <p className="updated">Última atualização: <time dateTime="2026-10-09">9 de outubro de 2026</time>.</p>
      <section><h2>O que está disponível agora</h2><p>As ferramentas disponíveis ajudam a comparar custos de moradia, alimentação, mobilidade e viagens, incluindo o planejamento de uma viagem ou a comparação de até quatro destinos. Não há cadastro ou login.</p></section>
      <section><h2>Contato e feedback por e-mail</h2><p>O contato é voluntário. Os links de feedback abrem seu aplicativo de e-mail com um texto para você revisar e enviar a gabgui2001@gmail.com. Você escolhe quais informações compartilhar. Nenhum dado financeiro, simulação salva ou informação pessoal é incluído automaticamente.</p><p>Esse contato é separado das simulações realizadas no navegador. A Coyler não armazena feedbacks em banco de dados próprio. As mensagens são recebidas no endereço informado e podem ficar armazenadas nos serviços de e-mail envolvidos.</p></section>
      <section><h2>Cálculos no seu navegador</h2><p>Os cálculos acontecem no próprio navegador. Os valores financeiros preenchidos não são enviados para servidores ou bancos de dados, nem incluídos em URLs.</p></section>
      <section><h2>Salvamento local opcional</h2><p>Os campos ficam na memória da página durante o uso. Ao escolher “Salvar simulação”, você armazena uma cópia apenas neste navegador, usando localStorage. Essa cópia é carregada na próxima visita. Alterações precisam ser salvas novamente.</p><p>Esse recurso não sincroniza dados entre dispositivos. O botão “Limpar meus dados” apaga os campos e a simulação salva desta calculadora. Quem tiver acesso ao mesmo navegador poderá ter acesso às simulações armazenadas. Se o armazenamento estiver bloqueado, o site avisará e você poderá limpar os dados nas configurações do navegador.</p></section>
      <section><h2>Preferência de tema</h2><p>O seletor oferece Claro, Escuro e Automático. Na primeira visita, a aparência acompanha o sistema operacional. Ao selecionar uma opção, salvamos apenas essa preferência no localStorage. Ela não contém dados financeiros, não é enviada para servidores e fica separada das simulações. Limpar uma calculadora não altera o tema; os dados do site podem ser removidos nas configurações do navegador.</p></section>
      <section><h2>Arquivos PDF e Excel</h2><p>Os arquivos são gerados no seu dispositivo a partir do resultado calculado. Seus valores financeiros não são enviados para nossos servidores para gerar os relatórios. O navegador pode baixar os arquivos de código necessários à exportação, sem incluir os valores da simulação nessas solicitações.</p><p>Os relatórios ficam no local que você escolher para o download. Compartilhá-los é uma escolha sua. “Limpar meus dados” não apaga arquivos que já foram baixados.</p></section>
      <section><h2>Dados técnicos da hospedagem</h2><p>Ao acessar um site, o serviço de hospedagem pode processar dados técnicos, como endereço IP, navegador, páginas solicitadas e registros de acesso, para entregar o conteúdo e operar o serviço. Isso depende da plataforma usada no deploy e de suas configurações.</p><p>Por isso, não afirmamos que nenhum dado técnico é coletado. Os detalhes da plataforma de hospedagem deverão ser incluídos aqui quando ela for definida.</p></section>
      <section><h2>Cookies, métricas e publicidade</h2><p>O código desta versão não inclui ferramentas de Analytics, publicidade, rastreamento ou cookies próprios. Se esses serviços forem adicionados, esta página será atualizada para explicar seu funcionamento e os controles aplicáveis.</p></section>
      <section><h2>Atualizações desta página</h2><p>Esta página acompanhará a evolução do produto. A data acima indicará a última revisão, e mudanças relevantes no tratamento de dados serão descritas aqui.</p></section>
    </article>
  );
}
