Você é um engenheiro de software full-stack sênior e product designer. Quero que construa um MVP completo, funcional e pronto para deploy de um site brasileiro de planejamento de custo de vida.

# 1. VISÃO DO PRODUTO

O projeto será um portal de calculadoras e ferramentas gratuitas para ajudar principalmente jovens adultos brasileiros a responder perguntas como:

- Quanto custa morar sozinho?
- Quanto preciso ganhar para morar sozinho?
- Quanto posso gastar de aluguel?
- Quanto preciso juntar antes de sair da casa dos meus pais?
- Qual deveria ser minha reserva de emergência?
- Para onde está indo meu dinheiro?
- Quanto sobraria da minha renda depois de morar sozinho?

No futuro, o projeto poderá evoluir para comparar custo de vida entre cidades e bairros brasileiros, comparar os gastos do usuário com referências de mercado, integrar dados públicos e oferecer outras calculadoras.

PORÉM, nesta primeira versão quero um MVP extremamente simples.

O objetivo principal é colocar o produto no ar rapidamente, validar interesse real dos usuários e permitir indexação pelo Google.

Não implemente funcionalidades futuras desnecessárias.

# 2. PRINCÍPIO FUNDAMENTAL

Priorize, nesta ordem:

1. simplicidade;
2. boa experiência do usuário;
3. SEO;
4. velocidade;
5. responsividade;
6. acessibilidade;
7. facilidade de manutenção;
8. baixo custo de hospedagem.

Evite overengineering.

Não crie backend apenas porque seria tecnicamente interessante.

# 3. STACK

Escolha uma stack moderna, simples e adequada para SEO e deploy gratuito/barato.

Preferência:

- Next.js
- TypeScript
- React
- Tailwind CSS

Utilize a versão estável disponível no ambiente.

Evite adicionar bibliotecas quando a mesma funcionalidade puder ser implementada facilmente com recursos nativos.

O projeto deve poder ser hospedado facilmente em serviços de hospedagem compatíveis com Next.js.

# 4. RESTRIÇÕES DO MVP

NÃO implementar nesta versão:

- banco de dados;
- PostgreSQL;
- MySQL;
- MongoDB;
- Firebase;
- Supabase;
- autenticação;
- cadastro;
- login;
- API própria;
- pagamentos;
- IA;
- chatbot;
- scraping;
- comparação real entre cidades;
- comparação entre bairros;
- dados fictícios apresentados como reais;
- infraestrutura AWS;
- Docker, a menos que seja estritamente necessário;
- Kubernetes;
- microserviços.

Os cálculos devem ocorrer localmente no navegador.

Quando for útil salvar dados do usuário, utilizar localStorage.

Nenhuma informação financeira preenchida pelo usuário deve ser enviada para servidores nesta versão.

# 5. IDIOMA E PÚBLICO

Todo o site deve estar em português do Brasil.

Público principal:

jovens brasileiros, aproximadamente entre 18 e 35 anos, planejando sair da casa dos pais, morar sozinhos, dividir apartamento ou entender melhor seu custo de vida.

Não use linguagem excessivamente financeira ou técnica.

O produto deve parecer amigável, moderno, confiável e simples.

# 6. IDENTIDADE VISUAL

Não quero aparência de sistema corporativo ou dashboard empresarial.

Quero aparência de produto digital moderno de finanças pessoais.

Use:

- bastante espaço em branco;
- tipografia limpa;
- cards;
- ícones discretos;
- boa hierarquia visual;
- números grandes nos resultados;
- gráficos simples quando realmente agregarem valor;
- excelente experiência mobile.

Evite:

- excesso de gradientes;
- excesso de animações;
- aparência de template genérico;
- interface carregada;
- tabelas enormes;
- elementos desnecessários.

Não invente logotipo complexo.

Utilize inicialmente um nome provisório fácil de substituir posteriormente.

# 7. HOME PAGE

Crie uma página inicial explicando claramente o propósito.

Hero sugerido:

"Quanto custa viver a vida que você quer?"

Subtítulo:

"Calcule quanto custa morar sozinho, organize seus gastos e descubra quanto você precisa para sair de casa com mais segurança."

CTA principal:

"Calcular meu custo de vida"

Abaixo, mostrar cards das ferramentas disponíveis:

- Calculadora de custo de vida
- Quanto posso pagar de aluguel?
- Quanto preciso juntar para sair de casa?
- Reserva de emergência

Cada ferramenta deve possuir URL própria e indexável.

# 8. FERRAMENTA PRINCIPAL

Criar a página:

/calculadora-custo-de-vida

Ela deve permitir preencher os gastos mensais de maneira organizada.

## RENDA

- salário líquido;
- vale-alimentação/vale-refeição;
- renda extra;
- outras rendas.

Não trate VA/VR automaticamente como dinheiro livre para qualquer despesa. Apresente-o separadamente quando necessário.

## MORADIA

- aluguel;
- condomínio;
- IPTU;
- energia;
- água;
- gás;
- internet.

## ALIMENTAÇÃO

- supermercado;
- refeições fora;
- delivery.

## TRANSPORTE

- combustível;
- transporte público;
- aplicativos;
- estacionamento;
- financiamento do veículo;
- seguro;
- manutenção.

## SAÚDE

- plano de saúde;
- medicamentos;
- consultas.

## VIDA PESSOAL

- academia;
- lazer;
- streaming;
- assinaturas;
- roupas;
- cuidados pessoais.

## FINANCEIRO

- parcelas;
- empréstimos;
- cartão/compromissos recorrentes;
- outros gastos.

Permitir que o usuário deixe campos vazios.

Valores devem utilizar formatação monetária brasileira.

# 9. RESULTADO DA CALCULADORA

Depois do preenchimento, mostrar claramente:

- renda mensal;
- benefícios alimentares separadamente;
- despesas totais;
- saldo mensal;
- percentual da renda comprometida;
- custo anual estimado;
- distribuição dos gastos por categoria.

Exemplo visual:

Renda líquida
R$ 5.000

Custo de vida
R$ 3.850

Sobra mensal
R$ 1.150

Custo anual
R$ 46.200

Mostrar também um gráfico simples da distribuição dos gastos.

Exemplo:

Moradia — 42%
Alimentação — 21%
Transporte — 14%
Lazer — 8%
Outros — 15%

Não faça julgamentos como "seu gasto está alto" ou "você gasta demais", porque nesta versão ainda não temos dados reais de comparação.

Podemos dizer apenas coisas matematicamente verificáveis, como:

"Moradia representa 42% das despesas informadas."

# 10. CENÁRIO DE MORAR SOZINHO

Na calculadora principal, permita que o usuário diferencie:

- gastos que já possui atualmente;
- gastos que estima que terá ao morar sozinho.

O objetivo é permitir que alguém que ainda mora com os pais simule sua vida futura.

Apresente:

"Custo mensal estimado para morar sozinho"

e

"Quanto sobraria da sua renda nesse cenário."

# 11. CALCULADORA DE ALUGUEL

Criar:

/quanto-posso-pagar-de-aluguel

Inputs:

- renda líquida mensal;
- outras rendas;
- despesas mensais existentes;
- valor desejado de aluguel;
- condomínio;
- IPTU.

Mostrar:

- custo total da moradia;
- percentual da renda comprometido;
- quanto sobra depois da moradia;
- quanto sobra depois das despesas informadas.

Não estabeleça uma regra universal afirmando que determinado percentual é necessariamente seguro.

Se mencionar referências percentuais, deixe claro que são referências gerais e não garantias financeiras.

# 12. CALCULADORA "QUANTO PRECISO JUNTAR?"

Criar:

/quanto-preciso-juntar-para-morar-sozinho

Inputs:

- caução/depósito;
- primeiro aluguel;
- mudança/frete;
- geladeira;
- cama;
- fogão;
- micro-ondas;
- máquina de lavar;
- móveis;
- utensílios domésticos;
- outras compras.

Permitir habilitar/desabilitar itens.

Permitir adicionar itens personalizados.

Mostrar:

"Custo inicial estimado para sair de casa"

e divisão por categorias.

Adicionar também:

"Quanto você já possui guardado?"

Resultado:

- custo total;
- valor já disponível;
- valor que falta.

Se o usuário informar quanto consegue guardar por mês, calcular:

"Neste ritmo, você levaria aproximadamente X meses para atingir esse valor."

# 13. RESERVA DE EMERGÊNCIA

Criar:

/calculadora-reserva-de-emergencia

Inputs:

- despesas essenciais mensais;
- quantidade de meses desejada.

Sugestões de botões:

3 meses
6 meses
9 meses
12 meses

Não diga que determinado número de meses é universalmente correto.

Mostrar:

- reserva escolhida;
- valor necessário;
- quanto já possui;
- quanto falta;
- tempo estimado para atingir a meta com determinado aporte mensal.

# 14. INTEGRAÇÃO ENTRE FERRAMENTAS

As ferramentas devem conversar entre si.

Por exemplo, depois da calculadora de custo de vida:

"Continue seu planejamento"

→ Calcule sua reserva

→ Veja quanto precisa juntar para a mudança

→ Descubra quanto da sua renda iria para aluguel

Criar navegação interna entre essas páginas.

# 15. LOCALSTORAGE

Permitir opcionalmente salvar a simulação no navegador.

Mostrar claramente:

"Seus dados ficam salvos somente neste navegador."

Criar botão:

"Limpar meus dados"

Não exigir cadastro.

Não enviar os valores financeiros para nenhum backend.

# 16. SEO

SEO é uma prioridade deste projeto.

Cada calculadora deve possuir:

- title único;
- meta description;
- canonical apropriado;
- heading H1 correto;
- headings H2/H3 semanticamente estruturados;
- conteúdo explicativo útil;
- Open Graph básico;
- sitemap;
- robots.txt;
- URLs amigáveis.

Estruture o projeto pensando em futuras páginas como:

/custo-de-vida/belem-pa
/custo-de-vida/curitiba-pr
/custo-de-vida/sao-paulo-sp
/comparar-custo-de-vida/belem-pa/curitiba-pr

MAS NÃO implemente dados de cidades agora.

Não crie centenas de páginas vazias para SEO.

# 17. CONTEÚDO

Cada ferramenta deve conter uma pequena seção abaixo dela explicando:

- para que serve;
- como funciona;
- limitações;
- como interpretar o resultado.

Não faça textos gigantes apenas para SEO.

Priorize conteúdo realmente útil.

# 18. DISCLAIMER

Adicionar aviso discreto:

"Os resultados apresentados são estimativas baseadas exclusivamente nos valores informados pelo usuário e possuem caráter informativo. Eles não constituem recomendação financeira."

# 19. PRIVACIDADE

Criar página:

/privacidade

Explicar de maneira simples que, nesta versão:

- os cálculos acontecem no navegador;
- os valores financeiros não são enviados para banco de dados;
- dados salvos localmente utilizam localStorage.

Estruture a página para podermos atualizá-la futuramente quando adicionarmos Analytics, publicidade ou outros serviços.

Não declare que nenhum dado técnico é coletado se isso não puder ser garantido pela plataforma de hospedagem.

# 20. COMPONENTIZAÇÃO

Evite duplicação.

Criar componentes reutilizáveis para:

- inputs monetários;
- cards;
- categorias;
- resultados;
- navegação;
- CTA;
- layout das calculadoras.

Separar lógica de cálculo da interface sempre que fizer sentido.

As funções matemáticas principais devem ser fáceis de testar.

# 21. QUALIDADE

Antes de considerar concluído:

- execute lint;
- execute build;
- corrija erros;
- verifique TypeScript;
- verifique links;
- verifique responsividade;
- verifique acessibilidade básica;
- teste valores zero;
- teste campos vazios;
- teste valores muito altos;
- teste números decimais;
- teste formatação em R$;
- teste localStorage;
- verifique se os cálculos estão corretos.

Crie testes automatizados para as funções de cálculo mais importantes se a stack já oferecer uma maneira simples de fazê-lo.

# 22. README

Criar README.md explicando:

- objetivo do projeto;
- stack;
- estrutura;
- como instalar;
- como executar localmente;
- como gerar build;
- como fazer deploy;
- onde ficam as funções de cálculo;
- onde alterar nome/branding;
- como adicionar uma nova calculadora futuramente.

# 23. ARQUITETURA FUTURA

Não implemente agora, mas organize o código para futuramente podermos adicionar:

- API;
- PostgreSQL;
- dados de custo de vida por cidade;
- dados por bairro;
- comparação do usuário com referências;
- dados públicos de IBGE/ANEEL/etc.;
- comparador entre cidades;
- contas de usuário;
- histórico de simulações;
- monetização por anúncios;
- links de afiliados;
- ferramentas de consumo de energia.

Não crie abstrações complexas agora apenas para suportar essas possibilidades.

# 24. PROCESSO DE EXECUÇÃO

Antes de programar:

1. analise todos os requisitos;
2. examine o estado atual do repositório;
3. defina uma arquitetura simples;
4. apresente um plano curto de implementação;
5. identifique qualquer requisito que esteja excessivamente complexo para o MVP;
6. então implemente.

Durante a implementação:

- tome decisões razoáveis sem me perguntar detalhes cosméticos;
- não pare a cada arquivo pedindo aprovação;
- não adicione funcionalidades fora do escopo;
- mantenha o projeto executável durante o desenvolvimento.

Depois:

1. rode os testes;
2. rode lint;
3. rode build;
4. corrija todos os erros encontrados;
5. revise os cálculos;
6. revise a experiência mobile;
7. informe quais arquivos principais foram criados;
8. explique como executar localmente;
9. liste claramente o que ficou propositalmente fora do MVP.

# 25. CRITÉRIO FINAL

Este projeto NÃO deve parecer uma demonstração técnica.

Ele deve parecer um pequeno produto real que eu poderia colocar em produção, indexar no Google e entregar para usuários brasileiros hoje.

Ao mesmo tempo, quero conseguir abandonar o projeto por algumas semanas sem precisar manter servidores, jobs, banco de dados ou infraestrutura complexa.

Quando houver uma escolha entre:

"arquitetura mais sofisticada"

e

"solução mais simples que resolve corretamente o problema",

escolha a segunda.

Agora analise o repositório, apresente o plano e comece a implementação.