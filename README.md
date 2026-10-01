# QuantoCusta

**Quanto custa a vida que você quer?**

Portal brasileiro de planejamento de gastos, moradia e independência financeira. Esta primeira etapa inclui apenas Home, privacidade e a base técnica. As quatro calculadoras são apresentadas como **Em breve**, sem links ou funcionalidades simuladas.

## Stack

Next.js (App Router), React, TypeScript e Tailwind CSS. ESLint para lint e Vitest para testes. Exportação estática, sem backend, APIs, banco de dados ou autenticação.

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

O Vitest está configurado com ambiente Node. Os testes atuais validam a configuração de domínio usada no SEO; ainda não há funções matemáticas nem testes de calculadoras.

## Estrutura

```text
src/app/                      Páginas, layout, estilos, favicon, robots e sitemap
src/components/               Header e footer
src/components/calculators/   Reservado para interfaces futuras
src/hooks/                    Reservado para hooks futuros
src/lib/site-config.ts        Nome, slogan, descrição e domínio
src/lib/tools.ts              Conteúdo dos cards de ferramentas
src/lib/calculations/         Reservado para cálculos futuros
tests/                        Testes Vitest
public/                       Imagem Open Graph
```

As pastas reservadas contêm apenas `.gitkeep`. Não há código antecipado para calculadoras.

## Build e deploy

Configure `SITE_URL` com o domínio público real, por exemplo `https://seu-dominio.com`, **antes** de executar `npm run build`. Sem essa variável, o fallback é `http://localhost:3000`, adequado apenas ao desenvolvimento. Canonical, Open Graph e sitemap dependem dessa configuração em tempo de build.

O build gera `out/`. Publique o conteúdo dessa pasta em uma hospedagem estática com HTTPS, suporte a `index.html` por diretório e página 404. Use `npm ci` como instalação e `npm run build` como comando de build. Não é necessário manter um processo Node em produção. `next start` não serve uma exportação estática.

As URLs usam barra final para funcionar com diretórios estáticos. `robots.txt` e `sitemap.xml` são gerados no build e incluem apenas páginas existentes. A prévia Open Graph fica em `public/og-image.png`.

A navegação usa links HTML nativos entre as duas páginas. Isso dispensa prefetch de dados de rotas e mantém a navegação funcional mesmo sem JavaScript em hospedagens estáticas simples.

Antes de publicar, revise a página de privacidade com as informações da plataforma de hospedagem escolhida. Não foram adicionados Analytics, publicidade, cookies próprios, fontes externas ou serviços de terceiros ao código.

## Branding e próximas etapas

Altere nome e slogan em `src/lib/site-config.ts`, texto da Home em `src/app/page.tsx`, cores em `src/app/globals.css`, favicon em `src/app/icon.svg` e prévia social em `public/og-image.png`.

Depois da aprovação da próxima etapa, cada calculadora terá sua rota em `src/app/`, interface em `src/components/calculators/`, funções puras em `src/lib/calculations/` e testes em `tests/`. Valores monetários serão representados em centavos inteiros. O planejamento priorizará o cenário futuro de morar sozinho, sem duplicar um formulário enorme para o cenário atual.

Os cálculos acontecerão no navegador. O salvamento em localStorage será opcional e ainda não foi implementado. API, cidades, contas, histórico e monetização permanecem fora desta etapa.
