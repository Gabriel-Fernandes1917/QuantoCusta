# QuantoCusta

**Quanto custa a vida que você quer?**

Portal brasileiro de planejamento de gastos, moradia e independência financeira. Inclui Home, privacidade, a calculadora de custo de vida em `/calculadora-custo-de-vida/` e o comparador em `/comparar-imoveis/`. As duas outras ferramentas continuam **Em breve**.

## Stack

Next.js (App Router), React, TypeScript e Tailwind CSS. ESLint para lint e Vitest para testes. PDF com `pdf-lib` e XLSX com `write-excel-file`. Exportação estática, sem backend, APIs, banco de dados ou autenticação.

TypeScript foi limitado à linha 6.0 para compatibilidade com o parser do ESLint. O ESLint 9 é a linha aceita pelos plugins incluídos na configuração atual do Next.js; o npm informa que essa linha deixou de receber suporte. A migração para ESLint 10 deve acontecer quando esses plugins declararem compatibilidade, sem forçar dependências incompatíveis.

## Executar localmente

Requer Node.js 24.13.1 ou superior e npm.

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. Para configurar o domínio, copie `.env.example` para `.env.local` e ajuste `SITE_URL`.

## Verificações

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

O Vitest usa ambiente Node. Os testes cobrem configuração de domínio, conversão e formatação de dinheiro, toda a lógica matemática do custo de vida e validação dos dados de armazenamento: campos vazios, renda e despesas zero, decimais, saldo negativo, VA/VR, valores altos e registros inválidos.

Também são testados veículo próprio ativado/desativado, conversão de IPVA/seguro/licenciamento anual, arredondamento, migração de dados antigos, abas/formatos do Excel e geração de PDF válido com múltiplas páginas.

## Estrutura

```text
src/app/                      Páginas, layout, estilos, favicon, robots e sitemap
src/components/               Header, footer, input monetário, cards e distribuição
src/components/calculators/   Interface interativa da calculadora de custo de vida
src/hooks/                    Reservado para hooks futuros
src/lib/site-config.ts        Nome, slogan, descrição e domínio
src/lib/tools.ts              Conteúdo dos cards de ferramentas
src/lib/calculations/         Funções puras e campos do custo de vida
src/lib/money.ts              Conversão e formatação em centavos inteiros
src/lib/simulation-storage.ts Validação e serialização da simulação salva
src/lib/export/               PDF, Excel, download e apresentação comum dos relatórios
tests/                        Testes Vitest
public/                       Imagem Open Graph
```

A pasta de hooks segue reservada. Não há código antecipado para as outras calculadoras.

## Calculadora de custo de vida

Um único formulário estima o cenário futuro de morar sozinho. As sete seções usam `details`/`summary` nativos, com apenas Renda aberta inicialmente. Campos vazios equivalem a zero; use vírgula para centavos, como `1.250,50`. Cada campo aceita até R$ 10.000.000.000,00; valores maiores ou com mais de duas casas decimais são rejeitados. Valores monetários são inteiros em centavos, sem arredondamentos na soma.

VA/VR não é somado à renda em dinheiro nem usado automaticamente. O usuário informa quanto pretende usar em alimentação. Esse uso é limitado ao menor entre o valor informado, o benefício disponível e as despesas alimentares. Despesas mensais e distribuição representam o custo total; saldo e renda comprometida usam apenas as despesas pagas em dinheiro. Com renda zero, o percentual é não calculável. O custo anual é o custo total mensal multiplicado por 12.

Os resultados aparecem após calcular; mudanças nos valores removem o resultado anterior até novo cálculo. O gráfico usa barras CSS com valores e percentuais em texto, sem biblioteca externa.

O salvamento é explícito e opcional: não há escrita automática. A chave `quantocusta:cost-of-living:v1` contém uma única simulação em centavos e versão do formato. A próxima visita restaura os campos; alterações exigem novo salvamento. “Limpar meus dados” remove somente essa chave e esvazia o formulário. Falhas do armazenamento são informadas sem impedir cálculos. Os valores não são enviados à rede nem colocados na URL.

### Transporte

A pergunta sobre veículo começa sem escolha; morar sozinho não presume possuir ou não possuir carro/moto. Transporte público e aplicativos sempre ficam disponíveis. “Sim” habilita combustível, financiamento, seguro, manutenção, IPVA, licenciamento/taxas, estacionamento e pedágios recorrentes. “Não” exclui os itens de veículo dos cálculos e relatórios, mantendo os valores digitados para uma eventual reativação.

Seguro, IPVA e licenciamento/taxas aceitam periodicidade mensal ou anual. IPVA e licenciamento começam em anual, seguro em mensal. O valor original é mantido em centavos. O equivalente mensal de um valor anual usa divisão inteira por 12, com arredondamento para o centavo mais próximo e metade para cima. O custo anual continua sendo o mensal estimado × 12: pode diferir em até R$ 0,06 por item anual do valor original. Esse comportamento é explicado na interface e nos relatórios.

O formato salvo passou para versão 2 dentro da mesma chave de armazenamento. Registros antigos são migrados apenas na leitura, sem escrita automática: novos campos começam em zero, seguro antigo mantém periodicidade mensal e gastos antigos de veículo ativam a subseção para preservar o total anterior.

### PDF e Excel

Depois de calcular, “Leve seu planejamento com você” permite baixar os dois arquivos. Exportadores recebem **somente o resultado já calculado**, incluindo detalhamento e equivalentes mensais produzidos pela função matemática principal. Não recalculam valores financeiros.

- `src/lib/export/pdf.ts`: usa `pdf-lib` para criar um PDF A4 com resumo, distribuição, despesas preenchidas e observações. Texto pesquisável, acentos portugueses, paginação, data de geração em horário de Brasília e rodapé. Usa Helvetica padrão do PDF, sem downloads de fontes ou imagens.
- `src/lib/export/excel.ts`: usa a entrada `write-excel-file/universal` para produzir um Blob XLSX, com abas “Resumo” e “Detalhamento”, números editáveis, formatos de Real/percentual, cabeçalhos e larguras de colunas. Valores anuais originais e equivalentes mensais aparecem lado a lado. Não inclui linhas de despesas zeradas ou veículo desativado.
- `src/components/export-planning.tsx`: carrega cada exportador via importação dinâmica somente ao clicar, informa o andamento/erros e inicia o download com URL local de Blob.

São duas dependências especializadas: impressão nativa não garante download direto de PDF, e CSV não atende às abas/formatos XLSX. As bibliotecas são servidas junto do site, sem CDN ou serviços externos. Seus valores financeiros nunca são enviados para gerar os arquivos. Downloads já realizados não são apagados pelo botão de limpar a simulação.

No build de produção revisado, os módulos carregados apenas ao exportar somaram aproximadamente **172 KiB gzip para PDF** e **24 KiB gzip para Excel**. Esses módulos não entram no carregamento inicial da calculadora. Valores são aproximados e podem variar com versões, minificação e compressão da hospedagem.

**Limitações:** o Excel é uma cópia editável, sem fórmulas entre abas; mudar valores não atualiza automaticamente os totais. O PDF usa fontes padrão compatíveis com português, não uma fonte personalizada incorporada. Downloads dependem das permissões do navegador. Não há comparação com mercado nem recomendações financeiras.

O rodapé é configurado em `src/lib/site-config.ts`: `reportDomain` usa o domínio de `SITE_URL` (omitido em localhost), ou o valor opcional de `REPORT_DOMAIN`. Configure essas variáveis antes do build. Data e nome dos arquivos usam o fuso `America/Sao_Paulo`.

## Build e deploy

Configure `SITE_URL` com o domínio público real, por exemplo `https://seu-dominio.com`, **antes** de executar `npm run build`. Sem essa variável, o fallback é `http://localhost:3000`, adequado apenas ao desenvolvimento. Canonical, Open Graph e sitemap dependem dessa configuração em tempo de build.

O build gera `out/`. Publique o conteúdo dessa pasta em uma hospedagem estática com HTTPS, suporte a `index.html` por diretório e página 404. Use `npm ci` como instalação e `npm run build` como comando de build. Não é necessário manter um processo Node em produção. `next start` não serve uma exportação estática.

As URLs usam barra final para funcionar com diretórios estáticos. `robots.txt` e `sitemap.xml` são gerados no build e incluem apenas páginas existentes. A prévia Open Graph fica em `public/og-image.png`.

A navegação usa links HTML nativos. Isso dispensa prefetch de dados de rotas e mantém a navegação funcional mesmo sem JavaScript em hospedagens estáticas simples. A calculadora exige JavaScript para calcular localmente; conteúdo explicativo e metadados são gerados em HTML no build.

Antes de publicar, revise a página de privacidade com as informações da plataforma de hospedagem escolhida. Não foram adicionados Analytics, publicidade, cookies próprios, fontes externas ou serviços de terceiros ao código.

## Branding e próximas etapas

Altere nome e slogan em `src/lib/site-config.ts`, texto da Home em `src/app/page.tsx`, cores em `src/app/globals.css`, favicon em `src/app/icon.svg` e prévia social em `public/og-image.png`.

Depois da aprovação da próxima etapa, uma nova calculadora deverá ter sua rota em `src/app/`, interface em `src/components/calculators/`, funções puras em `src/lib/calculations/` e testes em `tests/`. Reutilize os componentes monetários e de resultados. Acrescente a rota ao sitemap e disponibilize seu card em `src/lib/tools.ts` apenas quando funcional.

API, cidades, contas, histórico, monetização e as outras calculadoras permanecem fora desta etapa.

## Comparador de imóveis

`src/lib/calculations/property-comparison.ts` contém o modelo e funções puras de comparação, checklist, custos e deslocamento. A interface está em `src/components/calculators/property-comparison.tsx`, o armazenamento versionado em `src/lib/property-storage.ts` e os relatórios em `src/lib/export/property-comparison.ts`. Nenhuma dependência foi adicionada.

Os custos diretos somam aluguel/parcela/outro valor principal, condomínio, IPTU, garagem e custos personalizados. O total acrescenta serviços confirmados pelo usuário, transporte, alimentação relacionada à rotina e outros impactos. Diferenças são B − A, sem recomendação de imóvel. Itens anuais reutilizam a conversão inteira existente: `floor((centavos + 6) / 12)`. Total anual = mensal × 12; arredondamentos podem diferir até R$ 0,06 por item do valor anual original.

IPTU e garagem têm uma única origem: o checklist oferece atalhos para os mesmos campos diretos. Quando incluídos, seus valores separados ficam fora do cálculo. Outros serviços só entram quando o usuário confirma o impacto; respostas sem confirmação não recebem preço. Valores de diferenças que deixaram de existir também não entram nos resultados. Custos personalizados podem repetir qualquer despesa; a interface orienta a revisão porque não é possível inferir pelo nome se dois gastos são o mesmo.

O formulário usa seções nativas recolhíveis e cards verticais no celular; a partir de 800px os dois imóveis aparecem lado a lado. Deslocamento semanal = (minutos ida + volta) × dias ÷ 60; anual = semanal × 52; mensal = anual ÷ 12. Não desconta férias e feriados nem converte horas em dinheiro. Campos numéricos aceitam minutos entre 0 e 1440 e dias entre 0 e 7.

Salvar é explícito e usa a chave independente `quantocusta:property-comparison:v1`. A restauração valida o formato antes de usar os dados. Limpar remove apenas essa comparação, preservando a calculadora de custo de vida. O PDF é um relatório A4 paginado de comparação; o Excel contém Resumo, Comparação detalhada e Premissas, com valores monetários numéricos e periodicidades originais. A data de geração usa Brasília. Caracteres sem suporte na fonte padrão do PDF (como emojis) são substituídos por `?` apenas no relatório.

`tests/property-comparison.test.ts` cobre os vinte cenários solicitados, o exemplo completo (A: R$ 2.680/mês; B: R$ 3.120/mês; diferença R$ 440/mês e 32,5 horas/mês), validação de armazenamento e geração dos arquivos PDF/XLSX.
