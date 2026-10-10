# Coyler

**Preço não é necessariamente custo.**

Portal brasileiro para comparar custos e planejar escolhas de vida e viagens. Inclui sete ferramentas disponíveis, Home e Privacidade, sem cadastro ou backend.

## Ferramentas da V1

| Ferramenta | Rota |
|---|---|
| Calculadora de custo de vida | `/calculadora-custo-de-vida/` |
| Comparador de imóveis | `/comparar-imoveis/` |
| Comer fora ou cozinhar? | `/comer-fora-ou-cozinhar/` |
| Veículo próprio ou aplicativo? | `/veiculo-proprio-ou-aplicativo/` |
| Comparador de hospedagens | `/comparar-hospedagens/` |
| Veículo alugado ou aplicativo? | `/veiculo-alugado-ou-aplicativo/` |
| Quanto custa minha viagem? | `/custo-da-viagem/` |

O escopo funcional está encerrado. `SPEC.md` consolida a V1; a preparação para publicação corrige estabilidade e usabilidade, sem novas funcionalidades.

## Planejamento de viagem

`/custo-da-viagem/` permite planejar uma viagem ou comparar de dois a quatro destinos, com duração, grupo e orçamento independentes. As sete categorias de despesas são recolhíveis; a reserva opcional aparece separadamente. Campos vazios indicam valores não considerados e zero explícito indica um custo informado como zero.

- `src/lib/calculations/trip-cost.ts`: modelo e cálculo puro em centavos inteiros, com BigInt para produtos e arredondamento seguro. Subtotal soma as despesas; reserva percentual usa o subtotal; total soma subtotal e reserva. Custo por pessoa e por dia usa o total planejado.
- `src/lib/trip-form.ts`: campos de edição, conversão monetária e cenários iniciais sem preços presumidos.
- `src/components/calculators/trip-cost.tsx`: formulário, alternância de destinos, resultados, barras e comparação por categoria.
- `src/lib/trip-storage.ts`: validação e serialização versionada sob `quantocusta:trip-cost:v1`, independente das outras ferramentas.
- `src/lib/export/trip-cost.ts` e `src/components/export-trip.tsx`: PDF paginado e Excel com Resumo, Despesas detalhadas, Comparação de destinos (quando aplicável) e Premissas. São retratos da simulação; editar o Excel não recalcula os totais.

Os testes cobrem conversões por pessoa, noite, dia e quantidade, reservas, diferenças, cenários incompletos, limites seguros, persistência e geração real de PDF/XLSX. Os resultados não avaliam qualidade ou recomendam destinos. Não há preços automáticos nem integração entre ferramentas; a transferência de totais é manual.

“Uma viagem” valida e calcula somente o primeiro destino. Os demais permanecem como rascunhos em memória e reaparecem ao voltar a “Comparar destinos”; relatórios incluem somente cenários calculados. Salvar continua validando todos os destinos preservados no formato existente: pendências impedem a gravação e são indicadas para correção, sem descartar rascunhos nem substituir uma cópia salva válida.

Nomes vazios usam “Destino 1” a “Destino 4” no formulário, nos erros, nos resultados e nos relatórios. Passeios usam “Valor por ocorrência” ou “Valor por pessoa por ocorrência”; a matemática mantém o multiplicador de ocorrências e, quando aplicável, viajantes. Erros selecionam o destino, abrem a seção responsável, associam a mensagem ao campo e movem o foco sem perder os valores.

O feedback da Home usa links `mailto:` com `target="_blank"` e `rel="noopener noreferrer"`, além da alternativa de copiar o endereço. A abertura depende do navegador e do aplicativo configurado; não há confirmação de envio nem inclusão automática de dados da simulação.

## Stack

Next.js (App Router), React, TypeScript e Tailwind CSS. ESLint para lint e Vitest para testes. PDF com `pdf-lib` e XLSX com `write-excel-file`. Exportação estática, sem backend, APIs, banco de dados ou autenticação.

TypeScript foi limitado à linha 6.0 para compatibilidade com o parser do ESLint. O ESLint 9 é a linha aceita pelos plugins incluídos na configuração atual do Next.js; o npm informa que essa linha deixou de receber suporte. A migração para ESLint 10 deve acontecer quando esses plugins declararem compatibilidade, sem forçar dependências incompatíveis.

Risco conhecido da auditoria pré-publicação: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3` possui o advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), relacionado a esgotamento da pilha com padrões aninhados. Na auditoria, `npm audit` indicou cinco pacotes afetados dessa cadeia de desenvolvimento e `npm audit --omit=dev` indicou zero vulnerabilidades. Não foi aplicada atualização forçada. Reavaliar com `npm audit` e atualizar somente quando houver solução compatível e validada.

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
src/components/calculators/   Interfaces interativas das sete ferramentas
src/hooks/                    Reservado para hooks futuros
src/lib/site-config.ts        Nome, slogan, descrição e domínio
src/lib/tools.ts              Conteúdo dos cards de ferramentas
src/lib/calculations/         Modelos, validações e cálculos puros das sete ferramentas
src/lib/money.ts              Conversão e formatação em centavos inteiros
src/lib/simulation-storage.ts Validação e serialização da simulação salva
src/lib/export/               PDF, Excel, download e apresentação comum dos relatórios
tests/                        Testes Vitest
public/                       Imagem Open Graph
```

A pasta de hooks segue reservada. Cada ferramenta existente possui cálculo, interface, persistência e exportação próprios, com componentes monetários e estilos compartilhados.

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

Confira `SITE_URL=https://coyler.com.br` com o domínio planejado, **antes** de executar `npm run build`. Sem essa variável, a configuração usa o domínio planejado `https://coyler.com.br`. Isso não confirma registro, DNS ou hospedagem. Para uma origem local deliberada, configure `SITE_URL=http://localhost:3000`. Canonical, Open Graph e sitemap dependem dessa configuração em tempo de build.

O build gera `out/`. Publique o conteúdo dessa pasta em uma hospedagem estática com HTTPS, suporte a `index.html` por diretório e página 404. Use `npm ci` como instalação e `npm run build` como comando de build. Não é necessário manter um processo Node em produção. `next start` não serve uma exportação estática.

As URLs usam barra final para funcionar com diretórios estáticos. `robots.txt` e `sitemap.xml` são gerados no build e incluem apenas páginas existentes. A prévia Open Graph fica em `public/og-image.png`.

A navegação usa links HTML nativos. Isso dispensa prefetch de dados de rotas e mantém a navegação funcional mesmo sem JavaScript em hospedagens estáticas simples. A calculadora exige JavaScript para calcular localmente; conteúdo explicativo e metadados são gerados em HTML no build.

Antes de publicar, revise a página de privacidade com as informações da plataforma de hospedagem escolhida. Não foram adicionados Analytics, publicidade, cookies próprios, fontes externas ou serviços de terceiros ao código.

## Branding e próximas etapas

Altere nome e slogan em `src/lib/site-config.ts`, texto da Home em `src/app/page.tsx`, cores em `src/app/globals.css`, favicon em `src/app/icon.svg` e prévia social em `public/og-image.png`.

Depois da aprovação da próxima etapa, uma nova calculadora deverá ter sua rota em `src/app/`, interface em `src/components/calculators/`, funções puras em `src/lib/calculations/` e testes em `tests/`. Reutilize os componentes monetários e de resultados. Acrescente a rota ao sitemap e disponibilize seu card em `src/lib/tools.ts` apenas quando funcional.

API, cidades, contas, histórico, monetização e ferramentas além das sete listadas permanecem fora da V1. Registro/configuração do domínio planejado, hospedagem e detalhes do provedor na Política de Privacidade seguem pendentes; o site não foi publicado.

## Comparador de imóveis

`src/lib/calculations/property-comparison.ts` contém o modelo e funções puras de comparação, checklist, custos e deslocamento. A interface está em `src/components/calculators/property-comparison.tsx`, o armazenamento versionado em `src/lib/property-storage.ts` e os relatórios em `src/lib/export/property-comparison.ts`. Nenhuma dependência foi adicionada.

Os custos diretos somam aluguel/parcela/outro valor principal, condomínio, IPTU, garagem e custos personalizados. O total acrescenta serviços confirmados pelo usuário, transporte, alimentação relacionada à rotina e outros impactos. Diferenças são B − A, sem recomendação de imóvel. Itens anuais reutilizam a conversão inteira existente: `floor((centavos + 6) / 12)`. Total anual = mensal × 12; arredondamentos podem diferir até R$ 0,06 por item do valor anual original.

IPTU e garagem têm uma única origem: o checklist oferece atalhos para os mesmos campos diretos. Quando incluídos, seus valores separados ficam fora do cálculo. Outros serviços só entram quando o usuário confirma o impacto; respostas sem confirmação não recebem preço. Valores de diferenças que deixaram de existir também não entram nos resultados. Custos personalizados podem repetir qualquer despesa; a interface orienta a revisão porque não é possível inferir pelo nome se dois gastos são o mesmo.

O formulário usa seções nativas recolhíveis e cards verticais no celular; a partir de 800px os dois imóveis aparecem lado a lado. Deslocamento semanal = (minutos ida + volta) × dias ÷ 60; anual = semanal × 52; mensal = anual ÷ 12. Não desconta férias e feriados nem converte horas em dinheiro. Campos numéricos aceitam minutos entre 0 e 1440 e dias entre 0 e 7.

Salvar é explícito e usa a chave independente `quantocusta:property-comparison:v1`. A restauração valida o formato antes de usar os dados. Limpar remove apenas essa comparação, preservando a calculadora de custo de vida. O PDF é um relatório A4 paginado de comparação; o Excel contém Resumo, Comparação detalhada e Premissas, com valores monetários numéricos e periodicidades originais. A data de geração usa Brasília. Caracteres sem suporte na fonte padrão do PDF (como emojis) são substituídos por `?` apenas no relatório.

`tests/property-comparison.test.ts` cobre os vinte cenários solicitados, o exemplo completo (A: R$ 2.680/mês; B: R$ 3.120/mês; diferença R$ 440/mês e 32,5 horas/mês), validação de armazenamento e geração dos arquivos PDF/XLSX.

## Comer fora ou cozinhar?

`src/lib/calculations/meal-comparison.ts` contém as funções puras, `src/components/calculators/meal-comparison.tsx` a interface, `src/lib/meal-storage.ts` a persistência e `src/lib/export/meal-comparison.ts` os relatórios. A rota é `/comer-fora-ou-cozinhar/`, com card na Home, canonical, Open Graph e sitemap. Nenhuma dependência foi adicionada.

Cada refeição tem identificador, nome, inclusão explícita na comparação, frequência semanal, ingredientes e preço por refeição fora. Cada ingrediente tem identificador, nome, quantidade/unidade utilizada, preço em centavos e quantidade/unidade comprada. As unidades são g/kg, ml/L e unidade; massa não é convertida em volume. Os campos começam vazios, sem preços de exemplo. As quatro refeições iniciais são opcionais e podem ser removidas; refeições personalizadas também podem ser criadas.

Custo proporcional = preço da compra × quantidade utilizada normalizada ÷ quantidade comprada normalizada. Quantidades aceitam seis casas decimais e usam proporções inteiras com `BigInt` durante o cálculo; valores persistidos e resultados são números, com dinheiro em centavos. Cada ingrediente é arredondado ao centavo, metade para cima, antes da soma da refeição. Custo semanal = custo por refeição × frequência; anual = custo por refeição × frequência × 52; mensal = anual ÷ 12. Cada período é arredondado separadamente, então o anual pode diferir alguns centavos do mensal × 12. O total geral soma os períodos de cada refeição.

Gás, energia e outros custos de preparo são estimativas mensais opcionais. Entram somente no total em casa, sem rateio entre refeições. Distribuições e insights usam refeições, nunca rankings de ingredientes. Maior e menor diferença comparam a magnitude mensal e explicam a direção: custo em casa a mais ou a menos. Empates são mostrados juntos. Ingredientes ficam no detalhamento de auditoria.

Tempo de compras, preparo, limpeza e compra fora é informado em horas semanais. Mensal = semanal × 52/12; anual = semanal × 52, separado de dinheiro. Até 168 horas por cenário/semana, 20 refeições e 50 ingredientes por refeição; frequência de até 1.000 por semana. Quantidades inválidas, unidades incompatíveis e divisão por zero são rejeitadas.

Salvar é explícito na chave independente `quantocusta:meal-comparison:v1`; limpar remove somente essa rotina. O formato salvo é versão 2: preço fora, frequência e quantidades/preços dos ingredientes usam `null` para dados não informados, mantendo zero explícito como número. Campos opcionais de preparo e tempo vazios continuam sem acréscimo. Refeições incompletas são sinalizadas junto aos campos e excluídas dos totais, insights e linhas de custos exportadas; refeições completas continuam comparáveis. O relatório informa quais ficaram de fora, e exportação exige pelo menos uma refeição completa. Rascunhos incompletos podem ser salvos.

Na leitura de registros da versão 1, valores positivos são preservados, mas zeros essenciais passam a não informados e precisam ser confirmados. O formato antigo não permitia saber se esses zeros haviam sido digitados ou eram campos vazios. A migração não escreve automaticamente no armazenamento.

PDF A4 paginado e Excel com abas Resumo, Refeições, Detalhamento e Premissas recebem somente o resultado calculado e são carregados ao exportar. XLSX contém números editáveis, sem recálculo automático; PDF substitui caracteres não suportados pela fonte padrão. A diferença de tempo é apresentada como horas a mais no cenário correspondente, sem números negativos na mensagem principal. Maior/menor diferença mantêm a mesma matemática e indicam qual cenário custa menos por mês. Singular/plural de unidades é compartilhado com os relatórios, sem alterar nomes digitados. Os testes em `tests/meal-comparison.test.ts` e `tests/meal-refinements.test.ts` cobrem unidades, proporções, refeições, frequência, direção das diferenças, preparo, tempo, vazio/zero, migração, gramática, persistência e relatórios.

Não há avaliação nutricional, recomendações de alimentos, receitas, preços externos ou monetização do tempo. Esta versão compara a mesma frequência nos dois cenários; não implementa rotina híbrida. Dados financeiros não são enviados à rede.
## Veículo próprio ou aplicativo?

A rota `/veiculo-proprio-ou-aplicativo/` compara carro ou moto (já possuído, financiado ou alugado/por assinatura) com aplicativo de carro, moto ou ambos. A matemática fica em `src/lib/calculations/vehicle-comparison.ts`, separada da interface. Valores monetários são centavos inteiros; proporções e arredondamentos monetários usam BigInt, com metade para cima.

O modelo registra escolhas, periodicidades e valores numéricos `number | null`: vazio é não informado, zero explícito é preservado. Financiamento/aluguel, combustível no modo escolhido e frequência/tarifa do aplicativo são necessários. Os demais custos e a espera são opcionais. Os modos preservam valores editados, mas somente o modo ativo entra no cálculo. Seguro e manutenção aceitam mensal ou anual; IPVA/licenciamento são anuais. Em aluguel, informe separadamente apenas custos que não estejam incluídos no contrato.

- Mensal equivalente de custo anual: anual ÷ 12, arredondado ao centavo. Total anual preserva os anuais originais e soma mensais × 12; pode diferir alguns centavos de mensal × 12.
- Combustível estimado: km/mês ÷ km/L × preço/L; consumo deve ser maior que zero. O outro modo usa diretamente o gasto mensal informado.
- Aplicativo: corridas/semana × tarifa × 52/12 por mês, ou × 52 por ano, sem arredondar o semanal antes de calcular os outros períodos.
- Espera: corridas/semana × minutos/corrida ÷ 60, com 52/12 e 52 para mês/ano. Espera ausente é mostrada como não informada e nunca monetizada.

Salvamento opcional em `quantocusta:vehicle-comparison:v1`, com validação e limpeza isolada. PDF/Excel são carregados sob demanda e gerados no dispositivo; a planilha mantém números editáveis, sem recálculo automático. Os relatórios preservam periodicidades, entradas originais, estimativa de combustível e espera separada do dinheiro. A ferramenta usa os estilos atuais, metadata, canonical e sitemap; continua compatível com static export, sem backend ou novas dependências.

`tests/vehicle-comparison.test.ts` cobre 78 casos de cálculos, carro/moto, aquisição, custos opcionais, combustível, validação, persistência e relatórios reais. Fora da V1: depreciação, preço de compra/revenda, custo de oportunidade, simulação de financiamento, break-even, mapas, preços externos e recomendações de compra/venda.

## Comparar hospedagens

A rota `/comparar-hospedagens/` compara duas reservas diante da mesma viagem. O modelo e a matemática ficam em `src/lib/calculations/lodging-comparison.ts`, a interface em `src/components/calculators/lodging-comparison.tsx`, a persistência em `src/lib/lodging-storage.ts` e os relatórios em `src/lib/export/lodging-comparison.ts`. Não adiciona dependências, backend, APIs, mapas ou preços automáticos.

O modelo registra pessoas, noites, duas hospedagens (preço total/diária, taxas, refeições e estacionamento), transporte compartilhado, locais com dois conjuntos de estimativas e outros custos com valores A/B. Campos numéricos usam `number | null`: vazio não é zero. Nomes são opcionais; até 50 locais e 50 custos adicionais podem ser registrados. Pessoas, noites, dias e visitas são inteiros; distâncias, consumo e minutos aceitam até seis casas decimais. Dias de refeição e estacionamento são limitados a noites + 1, sem preenchimento automático.

- Reserva = preço total ou diária × noites. Refeição = valor/pessoa/dia × pessoas × dias; refeições incluídas não geram adicional.
- Estacionamento da hospedagem = total ou valor/dia × dias, somente com carro próprio/alugado e quando não incluído.
- Distância e tempo = valor por trecho × visitas × 2 (ida e volta) ou × 1 (somente ida/volta). Combustível = distância total ÷ km/L × preço/L, arredondado por local ao centavo com BigInt, metade para cima, sem arredondar litros.
- Aplicativo/manual, estacionamento do destino e pedágio = valor da visita completa × visitas. Não multiplicam por pessoas nem novamente por trechos. Estacionamento pode ter o mesmo valor para A/B ou valores próprios.
- Total comparável = reserva + taxas + refeições + estacionamento da hospedagem + deslocamentos + outros. Diferença financeira = A − B; por pessoa = total ÷ pessoas, arredondado ao centavo.

Tempo fica separado do dinheiro. Se faltar tempo em qualquer local, o total daquele cenário e a diferença não são apresentados como completos. Sem locais, deslocamentos e tempo são zero. Campos ocultos conservam valores válidos para quando forem reativados, mas não participam da matemática.

Salvar é explícito, na chave independente `quantocusta:lodging-comparison:v1`, com versão e validação do modelo. Limpar só remove esta simulação. PDF A4 paginado e Excel com Resumo, Hospedagens, Deslocamentos e Premissas são gerados localmente e carregados sob demanda. Excel mantém valores monetários numéricos, sem recálculo automático; a fonte padrão do PDF substitui caracteres não suportados por `?`. Metadata, canonical, sitemap e card da Home apontam para a nova rota, compatível com static export.

### Veículo alugado ou aplicativo na viagem

Rota `/veiculo-alugado-ou-aplicativo/`. Interface em `src/components/calculators/rental-comparison.tsx`, funções puras e validação em `src/lib/calculations/rental-comparison.ts`, persistência em `src/lib/rental-storage.ts` e relatórios em `src/lib/export/rental-comparison.ts`. Reutiliza `MoneyInput`, cálculo de combustível, duração, pluralização e estilos atuais. Não adiciona dependências.

O modelo mantém dias da viagem, pessoas opcionais, tipo do veículo, cotação diária/total, checklist de itens incluídos, adicionais, combustível direto/por distância, estacionamento total/diário, pedágios, limpeza, extras, caução e lista de corridas. Campos vazios permanecem `null`; valores ocultos são preservados ao alternar opções e salvos quando válidos. Cada corrida tem quantidade, preço e espera na ida e, quando aplicável, na volta. Cards abrem ao criar e podem ser recolhidos sem perder dados.

Locação = diária × diárias ou total informado. Combustível = km / km/L × preço por litro ou valor direto. Estacionamento = valor diário × dias ou valor total. Itens marcados como incluídos não geram adicionais. Total do veículo soma locação, extras da locadora, combustível, estacionamento, pedágios, limpeza e extras; caução fica separada. Corridas usam valor da ida × quantidade ou (ida + volta) × quantidade. Pessoas não multiplicam custos. Médias por dia/pessoa são arredondadas ao centavo, metade para cima. A comparação mostra a diferença absoluta em reais. Quantidade estimada de corridas soma uma por ocorrência de somente ida e duas por ocorrência de ida e volta; custo médio por corrida = total do aplicativo / quantidade total de corridas, com proteção para zero corridas. Dinheiro é calculado em centavos inteiros, com proteção contra totais fora do intervalo seguro.

Espera usa apenas minutos informados × frequência, sem monetização nem duração dos trajetos. Nenhuma espera preenchida é “não informada”; trechos ausentes tornam a soma “parcial”. Os relatórios mantêm essa distinção. PDF A4 paginado inclui entradas, totais, composição, corridas, espera, caução separada e premissas. Excel tem Resumo, Veículo alugado, Corridas e Premissas, com números editáveis e sem recálculo automático.

Salvar é opcional, na chave independente `quantocusta:rental-comparison:v1`; limpar só remove essa simulação. SEO, canonical, Open Graph, sitemap e card da Home incluem a ferramenta. Comparar voos está fora da V1. Não busca preços ou rotas, não aplica multiplicadores de tarifa, não avalia conforto nem recomenda uma estratégia. Limites do formulário: até 50 corridas e 50 extras, nomes com até 80 caracteres e quantidades até 1 milhão. O cenário de regressão está apenas nos testes: veículo R$ 1.560,00, aplicativo R$ 520,00, diferença R$ 1.040,00 e espera 137 minutos (2h17).

`tests/lodging-comparison.test.ts` cobre 116 casos de preços, refeições, estacionamentos, modos e tipos de deslocamento, locais compartilhados, combustível, tempo, diferenças, precisão, validação, persistência e geração real dos relatórios. No cenário de 2 pessoas/4 noites, sem custo adicional informado de estacionamento da hospedagem, Hotel Centro totaliza R$ 2.044,80 e Hotel Econômico R$ 1.868,80: diferença R$ 176,00, com 40 e 120 minutos de deslocamento respectivamente. A ferramenta compara somente os custos informados associados à hospedagem e não recomenda uma opção.

## Regressões de estabilidade

Nomes extensos quebram nos resultados sem ocultar valores ou criar rolagem horizontal. A limpeza de veículo próprio, hospedagens e veículo alugado sempre esvazia os campos e resultados em memória; se localStorage.removeItem falhar, o aviso informa que a cópia salva não pôde ser removida. Salvar e restaurar continuam com seus tratamentos de erro e formatos originais.

`tests/trip-stability.test.ts` integra `npm test` e cobre modos, rascunhos, erros identificados, nomes, multiplicadores e conteúdo dos relatórios. Para a integração de produção, sirva `out/` em `127.0.0.1:4173` e execute Chrome headless com perfil isolado e porta de depuração 9222. Rode `node tests/prepublication-browser-check.mjs` e `node tests/trip-browser-check.mjs`.

A verificação pré-publicação testa as sete ferramentas, relatórios gerados em memória, salvar/restaurar/limpar, falhas `SecurityError`, nomes de 80 caracteres sem espaços em 320/390 px e correção de despesas com foco acessível. Os dados do perfil de teste são restaurados ao final. Não há downloads gravados pelo novo teste. Alterações somente de formatação monetária ao perder foco mantêm o resultado válido da viagem.

## Marca Coyler e temas

A marca pública, os metadados e os relatórios usam Coyler; o logotipo textual é `coyler.` com símbolo SVG próprio. `public/og-image.svg` é a fonte vetorial da imagem PNG de compartilhamento. O favicon SVG e os PNGs de 32/180 px usam o mesmo símbolo. Os documentos continuam claros para impressão, independentemente do tema.

As chaves internas `quantocusta:*` das simulações foram preservadas por compatibilidade. Não representam a marca pública e não devem ser renomeadas sem migração. Os nomes dos downloads agora começam com `coyler-`.

`src/lib/theme.ts` aplica o tema antes da renderização do corpo. O seletor no header oferece Claro, Escuro e Automático. A primeira visita acompanha o sistema sem gravar preferência; escolhas explícitas são salvas em `coyler:theme:v1`. Automático responde a mudanças do sistema; abas sincronizam escolhas via evento storage. Se o armazenamento falhar, a seleção ainda funciona na visita. Não há provider global nem dependência nova. CSS oferece fallback ao sistema sem JavaScript. O aviso de hidratação é suprimido apenas no elemento html, cujos atributos de tema são alterados pelo script inicial; componentes continuam com hidratação normal.

## SEO e publicação da Coyler

A URL base fica em `src/lib/site-config.ts`. `pageMetadata` padroniza canonical, Open Graph e Twitter específicos de cada página. Sitemap usa o catálogo real de ferramentas e não inventa lastModified. A Home contém WebSite e as sete calculadoras contêm WebApplication em JSON-LD, sem organização jurídica, estrelas, reviews ou volumes inventados. Isso não garante resultados enriquecidos ou posições de busca. Links entre ferramentas e conteúdo explicativo são HTML estático.

PDF e Excel são carregados separadamente: pedir Excel não baixa a biblioteca PDF. Fontes são locais/do sistema, ilustrações são SVG e não há serviços de imagem ou tracking. Medir bundles e métricas locais não equivale a certificar Core Web Vitals de produção; LCP/INP/CLS de campo dependem do deploy e uso real.

Checklist externo (nenhuma dessas ações foi realizada):

- Confirmar e registrar coyler.com.br; escolher provedor e configurar DNS/HTTPS.
- Publicar `out/`, servir index.html por diretório e 404.html com status HTTP 404. Não aplicar fallback de SPA para URLs inexistentes.
- Configurar redirecionamentos HTTP para HTTPS e www para não-www no provedor, nunca com redirects de servidor dentro do export estático.
- Usar cache longo/imutável nos assets com hash, compressão Brotli/gzip e revalidação de HTML. Revisar CSP conforme os scripts inline de tema/JSON-LD e do Next; não bloquear esses scripts sem fornecer hashes compatíveis.
- Completar a Política de Privacidade com o provedor real e seus dados técnicos.
- Confirmar HTTPS, canonical, sitemap, links e relatórios na origem pública; testar Safari/iOS, Android, teclado e zoom.
- Verificar propriedade real no Google Search Console e Bing Webmaster Tools, adicionar o sitemap e usar inspeção de URLs. Não adicionar códigos fictícios.
- Medir Lighthouse/PageSpeed e acompanhar LCP, INP e CLS de campo quando houver dados. O projeto não está publicado nem sua indexação foi confirmada.

Referências técnicas: [Metadata API do Next.js](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), [JSON-LD no Next.js](https://nextjs.org/docs/app/guides/json-ld), [dados estruturados de apps](https://developers.google.com/search/docs/appearance/structured-data/software-app) e [Web Vitals](https://web.dev/articles/vitals).

### Verificação do rebranding, tema e SEO

`npm test` inclui `tests/theme.test.ts`, `tests/seo.test.ts` e os testes de configuração. Com o export servido em 4173 e Chrome isolado em 9222, `node tests/coyler-browser-check.mjs` verifica tema inicial antes do primeiro frame, recarga, preferência do sistema, teclado, movimento reduzido, storage bloqueado, metadados/JSON-LD das nove páginas, links, assets e contraste de textos visíveis. Também verifica que Excel não carrega o chunk PDF. `node tests/prepublication-browser-check.mjs` exercita cenários e exportações das sete ferramentas em ambos os temas e nas seis larguras especificadas.

O teste de contraste é uma verificação básica de texto visível com fundos sólidos, não uma certificação de acessibilidade. Reflow também é exercitado com ampliação CSS de 200%; zoom real e leitor de tela permanecem parte da revisão manual em dispositivos.
