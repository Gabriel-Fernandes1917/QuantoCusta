# Coyler — especificação da V1

Esta especificação consolida as sete ferramentas existentes. O desenvolvimento funcional da V1 está encerrado; a etapa atual corrige estabilidade e usabilidade antes do primeiro lançamento público.

## Produto e escopo

Portal gratuito em português do Brasil para planejar e comparar custos com valores informados pelo usuário. Resultados são estimativas informativas, sem preços automáticos, referências de mercado ou recomendação financeira.

| Ferramenta | Rota |
|---|---|
| Calculadora de custo de vida | /calculadora-custo-de-vida/ |
| Comparador de imóveis | /comparar-imoveis/ |
| Comer fora ou cozinhar? | /comer-fora-ou-cozinhar/ |
| Veículo próprio ou aplicativo? | /veiculo-proprio-ou-aplicativo/ |
| Comparador de hospedagens | /comparar-hospedagens/ |
| Veículo alugado ou aplicativo? | /veiculo-alugado-ou-aplicativo/ |
| Quanto custa minha viagem? | /custo-da-viagem/ |

Home e Privacidade completam as páginas públicas. O sitemap inclui somente rotas existentes. Ferramentas de aluguel máximo, mudança, reserva de emergência, voos e comparação entre cidades não fazem parte desta V1.

## Arquitetura e restrições

- Next.js App Router, React, TypeScript e Tailwind CSS, com exportação estática em `out/`.
- Páginas em `src/app/`, interfaces em `src/components/calculators/` e cálculos puros em `src/lib/calculations/`.
- Persistência versionada e independente por ferramenta em `src/lib/*-storage.ts`; custo de vida usa `simulation-storage.ts`.
- PDF com `pdf-lib` e Excel com `write-excel-file`, carregados sob demanda e gerados no dispositivo.
- Sem backend, API própria, banco de dados, autenticação, pagamentos, Analytics, anúncios, mapas ou serviços externos.
- Valores financeiros não são enviados à rede nem incluídos em URLs. Transferência de totais entre ferramentas é manual.
- Reutilizar componentes e estilos. Não criar funcionalidades, refatorações ou dependências desnecessárias nesta etapa.
- Não publicar até autorização específica.

## Regras comuns de dinheiro e apresentação

Dinheiro é representado em centavos inteiros, com validação de negativos, entradas inválidas e limites seguros. Cada campo monetário aceita até R$ 10.000.000.000,00. Produtos e proporções usam proteção contra perda silenciosa de precisão; divisões monetárias arredondam metade para cima.

Campos vazios e zero seguem o modelo de cada ferramenta: custo de vida e imóveis tratam vazio como zero; alimentação, mobilidade e viagens distinguem dados essenciais não informados de zero explícito. Custos opcionais vazios não acrescentam despesas.

Pessoas, dias, noites, quantidades e ocorrências entram somente nas fórmulas documentadas. Tempo permanece separado do dinheiro. Custos incluídos ficam fora dos adicionais correspondentes. Despesas personalizadas precisam ser revisadas pelo usuário para evitar duplicações.

PDF e Excel recebem resultados calculados, sem recalcular as fórmulas. A planilha contém valores numéricos editáveis, sem atualização automática dos totais. Relatórios incluem premissas, identificação da Coyler e data em America/Sao_Paulo.

## Comportamento das sete ferramentas

### Custo de vida

Um formulário estima o cenário futuro de morar sozinho, com renda, moradia, alimentação, transporte, saúde, vida pessoal e compromissos financeiros. VA/VR não integra renda em dinheiro: seu uso em alimentação é limitado ao benefício disponível, ao gasto alimentar e ao uso solicitado. Saldo e renda comprometida consideram despesas pagas em dinheiro.

Despesas de veículo próprio entram somente quando habilitadas. Seguro, IPVA e licenciamento aceitam periodicidade mensal/anual. Total anual = mensal × 12; valores anuais convertidos podem diferir em até R$ 0,06 por item após arredondamento.

### Imóveis

Compara dois cenários com aluguel/parcela/outro custo principal, condomínio, IPTU, checklist de itens incluídos, impactos confirmados, transporte, alimentação relacionada e outros custos. Custos únicos ficam separados dos recorrentes; compensação compara diferença inicial e economia mensal constante.

Anual recorrente = mensal × 12. Deslocamento usa (ida + volta) × dias por semana, 52 semanas por ano e 52/12 por mês. Sem preços de mercado ou recomendação de imóvel.

### Alimentação

Compara a mesma frequência de refeições em casa e fora. Ingredientes usam custo proporcional à quantidade comprada e utilizada, com conversões g/kg, ml/L ou unidades compatíveis. Cada ingrediente é arredondado antes da soma.

Frequência semanal usa 52 semanas por ano e 52/12 por mês, com arredondamentos independentes. Preparo mensal e tempo são opcionais. Refeições incompletas são identificadas e excluídas dos totais; pelo menos uma refeição completa é necessária para comparar e exportar. Rascunhos incompletos podem ser salvos neste modelo.

### Veículo próprio ou aplicativo

Compara carro/moto já possuído, financiado ou alugado/por assinatura com aplicativo. Combustível usa gasto direto ou km ÷ km/L × preço por litro. Custos anuais preservam seus originais no total anual; mensal pode diferir de anual ÷ 12 após arredondamento.

Aplicativo usa corridas/semana × tarifa, 52 semanas/ano e 52/12 por mês. Espera é opcional e não monetizada. Não considera depreciação, compra/revenda, custo de oportunidade nem simula financiamento.

### Hospedagens

Compara duas reservas para a mesma quantidade de pessoas e noites. Soma reserva total/diária, taxas, refeições adicionais, estacionamento, deslocamentos e extras. Refeições adicionais usam preço × pessoas × dias; incluídas não são somadas novamente.

Locais usam visitas e trechos. Combustível considera distância e consumo; tarifas, estacionamento e pedágios são valores por visita completa. Tempo incompleto não é apresentado como total conhecido. Pessoas dividem o total por pessoa.

### Veículo alugado ou aplicativo

Locação usa total ou diária × diárias. Soma adicionais não incluídos, combustível, estacionamento, pedágios, limpeza e extras. Dias da viagem, diárias e dias de estacionamento são independentes. Caução fica separada do custo.

Corridas de ida usam tarifa × quantidade; ida e volta usam (ida + volta) × quantidade. Ida e volta representam duas corridas para a média agregada. Pessoas apenas dividem custos. Espera ausente ou parcial é identificada e não monetizada.

### Viagem

Permite uma viagem ou comparação de dois a quatro destinos, com duração, viajantes e orçamento independentes. Despesas usam total, pessoa, noite, pessoa/dia ou quantidade conforme a categoria. Passeios multiplicam o valor por ocorrências; no modo por pessoa também multiplicam pelos viajantes. O texto deve esclarecer “Valor por ocorrência” e “Valor por pessoa por ocorrência”.

Subtotal soma despesas. Reserva fixa ou percentual do subtotal é separada; total = subtotal + reserva. Médias por dia/pessoa dividem o total. Categorias usam subtotal como base percentual.

No modo “Uma viagem”, somente o primeiro destino é validado e calculado. Outros destinos ficam preservados em memória como rascunhos e reaparecem ao voltar à comparação, quando são validados. PDF e Excel incluem somente destinos calculados.

O formato salvo permanece inalterado. Salvar valida todos os destinos preservados: não descarta destinos nem grava rascunhos inválidos como se fossem completos. Uma pendência impede o salvamento, mantém os valores e identifica o campo para correção.

Nomes vazios usam Destino 1, Destino 2, Destino 3 e Destino 4 de forma consistente em formulário, erros, resultados e relatórios. Nomes personalizados são preservados.

## Persistência e privacidade

Salvamento é explícito e opcional em localStorage. Cada ferramenta limpa somente sua chave. Falhas na remoção persistida não impedem limpar os campos e resultados em memória; a mensagem distingue a cópia que não pôde ser removida.

Quem compartilha o navegador pode acessar simulações salvas. Limpeza não apaga relatórios já baixados. Feedback usa mailto com texto fixo para revisão voluntária, sem anexar dados financeiros.

A política descreve o funcionamento local e reconhece possíveis dados técnicos da hospedagem. Seus detalhes serão completados somente após escolha do provedor.

## Usabilidade, acessibilidade e SEO

Manter o design existente. Formulários usam labels, foco visível, seções recolhíveis e mensagens associadas aos campos inválidos. Erros da viagem selecionam o destino responsável, abrem a seção e focam o primeiro campo inválido preservando entradas.

Nomes extensos, inclusive 80 caracteres sem espaços, devem quebrar sem esconder valores ou criar rolagem horizontal em 320 e 390 px. Navegação por teclado e preferência por movimento reduzido devem funcionar.

Cada página tem título, descrição, canonical, Open Graph, H1 e conteúdo explicativo indexável no HTML estático. SITE_URL usa o domínio planejado https://coyler.com.br, sem afirmar que foi registrado. REPORT_DOMAIN acompanha essa configuração; registro, DNS, HTTPS, hospedagem e detalhes do provedor permanecem pendentes.

## Validação e publicação

Executar `npm test`, `npm run lint`, `npm run typecheck` e `npm run build`. Verificar `out/`, regressões de modos, dados, erros, limpeza com SecurityError, nomes longos, PDF e Excel.

Registrar vulnerabilidades conhecidas. Não usar `npm audit fix --force` nem atualizar majors nesta etapa. A cadeia de desenvolvimento do ESLint com braces é um risco conhecido; atualizar somente com correção compatível validada.

A hospedagem deve servir arquivos estáticos por diretório, assets, HTTPS e página 404. Escolha do domínio, configuração da hospedagem, atualização da política e publicação exigem a etapa posterior autorizada.

## Identidade e tema para o lançamento

Marca pública: Coyler; logotipo textual coyler. Título aprovado da Home: “O menor preço nem sempre é o menor custo.” Subtítulo aprovado: “Enxergue além do preço. Compare todos os custos envolvidos em suas escolhas e descubra o que realmente compensa para você.” Preservar esses textos exatamente.

Claro, Escuro e Automático são selecionados no header. Primeira visita segue o sistema; escolha explícita usa a chave coyler:theme:v1. Aplicar tema antes da primeira renderização, acompanhar mudanças do sistema no modo automático e manter controles acessíveis. Tokens semânticos abrangem todas as páginas, campos, resultados, alertas e estados de foco. PDF e Excel mantêm aparência clara independente do tema.

As chaves legadas quantocusta:* e os formatos de simulações permanecem para compatibilidade; rebranding não apaga dados. O nome dos downloads usa coyler-. Metadata API estática, JSON-LD WebSite/WebApplication verdadeiro e links internos descritivos complementam o conteúdo explicativo. Não inventar ratings, estatísticas, serviços ou promessas de indexação.

Validar 320, 375, 390, 768, 1024 e 1440 px, ambos os temas, preferência automática, recarga, falhas de armazenamento, teclado e zoom. Não adicionar analytics para medir desempenho. Resultados de performance devem distinguir medições locais de métricas de campo após o deploy.
