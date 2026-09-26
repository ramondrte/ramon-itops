# Ambientes e estratégia de deploy

## Estado

Preparação de configuração concluída; aplicação pública ainda não provisionada. Não há conta criada, OAuth autorizado, assinatura ou recurso pago. Não use túneis para o computador, IP residencial ou banco de desenvolvimento.

## Comparação de hospedagem

Consulta às fontes oficiais em 26/09/2026 UTC. Limites/preços podem mudar; conferir no momento de contratar.

| Opção | Adequação e limitações |
| --- | --- |
| Render Static Site + Web Service + Neon | Proposta inicial: frontend estático e API Fastify sem adaptação serverless, banco gerenciado separado. API gratuita suspende após 15 min sem tráfego; primeira resposta pode ser lenta. Dois provedores e quotas gratuitas. |
| Render com PostgreSQL próprio | Menos fornecedores e operação centralizada. Banco gratuito expira após 30 dias; inadequado para demo duradoura. Banco pago depende de orçamento aprovado. |
| Vercel + Render + Neon | Frontend com deploy por Git e HTTPS. Mantém API Node convencional no Render; adiciona um terceiro painel sem necessidade imediata. Conferir restrições do plano Hobby. |
| Railway + Neon | Deploy Node simples; Hobby tem mínimo de US$5 de consumo e excedentes. Templates de banco Railway são serviços não gerenciados, com responsabilidade operacional do usuário; Neon atende melhor o requisito de banco gerenciado. |

Fontes: [Render gratuito](https://render.com/docs/free), [Static Sites](https://render.com/docs/static-sites), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Railway preços](https://railway.com/pricing), [Railway bancos](https://docs.railway.com/databases), [Neon planos](https://neon.com/docs/introduction/plans).

Recomendação: Render para frontend/API e Neon para PostgreSQL. Aceitar cold start na demonstração inicial; se indisponibilidade inicial for inaceitável, avaliar API paga somente após aprovação. Não há garantia de operação gratuita ilimitada. Não é necessário contratar todos os fornecedores avaliados.

## Configuração

`production.env.example` é referência com placeholders, não arquivo de secrets.

| Variável | Destino e regra |
| --- | --- |
| NODE_ENV | API/CLI: production no ambiente público; não carrega .env local |
| PORT | API: precedência sobre API_PORT; porta fornecida pela plataforma |
| API_HOST | API: padrão 0.0.0.0 em produção; loopback em desenvolvimento |
| DATABASE_URL | Somente servidor: conexão do banco remoto com sslmode=verify-full em produção |
| MIGRATION_DATABASE_URL | CLI de migrations: conexão direta quando disponível; fallback DATABASE_URL |
| CORS_ORIGINS | API: origens HTTPS exatas separadas por vírgula; sem wildcard, credenciais ou caminhos |
| VITE_API_BASE_URL | Build do frontend: URL HTTPS da API; pública, nunca contém segredo |
| WEB_PORT | Apenas servidor Vite local, padrão 5173 |
| POSTGRES_PORT | Apenas Compose local; manter alinhada com DATABASE_URL |

A conexão `pg` usa TLS conforme URL, sem desabilitar verificação de certificado. Providencie CA confiável conforme o provedor; nunca use rejectUnauthorized=false. Pool limitado a cinco conexões por processo. Dimensionar quantidade de instâncias conforme limite do banco.

Frontend padrão usa `/api` no mesmo domínio. Em desenvolvimento/preview isso é atendido pelo proxy Vite; hospedagem estática exige definir VITE_API_BASE_URL ou configurar proxy HTTPS externo. O valor é incorporado no build, portanto alteração exige rebuild. Variáveis VITE_ são públicas. A configuração valida URL no carregamento; não confundir isso com proteção de secrets.

## Receita de publicação futura

1. Aprovar provedor, contas/OAuth e eventual orçamento. Criar banco e ambientes isolados, somente dados fictícios.
2. API: raiz do monorepo; build `npm ci && npm run build`; start `npm run start -w @ramon-itops/api`; Node.js 22. Configurar secrets no painel, NODE_ENV=production e CORS_ORIGINS com domínio exato do frontend.
3. Executar uma vez por release `npm run db:migrate` com conexão remota direta e verificar status, antes de liberar tráfego. Se o plano não tiver pre-deploy job, usar execução administrativa controlada; não embutir migrations no startup de cada réplica. Seed demo é explícito e opcional. Backup antes de mudanças; não editar migrations aplicadas.
4. Frontend: build `npm ci && npm run build -w @ramon-itops/web`; diretório `apps/web/dist`; VITE_API_BASE_URL com a URL HTTPS da API. Configurar rewrite de rotas SPA para `/index.html`, preservando assets. Testar acesso direto a `/tickets/:id`.
5. Health check da plataforma em `/health/ready`; `/health` verifica somente processo. HTTPS termina na plataforma; não publicar porta do PostgreSQL nem depender do Mac.
6. Validar origem autorizada/preflight PATCH, rejeição de leitura cross-origin não autorizada, criação, SLA, filtros, persistência após redeploy e logs sem secrets.
7. Inserir URLs reais de Live Demo e API Health no README somente após validação pública.

## Decisões ainda necessárias

Sem autenticação, qualquer cliente pode criar/alterar chamados. CORS limita leitura pelo navegador, não autentica e não impede scripts externos. Antes de abertura pública, escolher demo somente leitura ou escrita anônima controlada com limitação de requisições, política de dados e limpeza. Nenhuma dessas regras foi adicionada neste polimento para preservar o escopo funcional.

Autorização de contas, OAuth, termos e cobrança permanece pendente. Nenhuma mudança em portas residenciais, encaminhamento de rede ou banco local é necessária.
