# Ambientes e estratégia de deploy

## Estado

Preparação de configuração e proteções de demo concluída; aplicação pública ainda não provisionada. Não há conta criada, OAuth autorizado, assinatura ou recurso pago. Não use túneis para o computador, IP residencial ou banco de desenvolvimento.

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

## Sequência para Render + Neon (pendente de autorização)

1. Autorizar contas pessoais Render/Neon e, se escolhido, GitHub App/OAuth Render restrito a ramon-itops. Conferir permissões reais na tela; não ampliar a outros repositórios. Sem cartão, upgrade ou cron pago.
2. Criar projeto Neon Free separado; manter credenciais somente no gerenciador de secrets. Preferir regiões próximas da API. DATABASE_URL de runtime e conexão direta para migrations, ambas com TLS verificado.
3. Em sessão administrativa controlada, executar npm ci, npm run build, npm run db:migrate, npm run db:migrate:status e npm run db:seed:demo no banco remoto. Executar demo:prepare com UUID exclusivo e confirmação, conforme [política demo](demo-environment.md). Não usar startup de API para migrations. Free Render não dispõe de shell/one-off/pre-deploy como planos pagos; a execução administrativa pode partir da estação com acesso TLS ao Neon, sem expor a estação nem exigir que continue ligada.
4. Criar os serviços a partir de deploy/render.demo.yaml, conferindo nomes e plano Free. Preencher origens/URLs reais após reservar serviços; manter deploy automático desabilitado até validar o fluxo de release. O arquivo não cria banco Render ou cron.
5. API: NODE_ENV=production, API_HOST=0.0.0.0, PORT fornecida pelo Render, CORS_ORIGINS exata, DATABASE_URL, DEMO_MODE=true, DEMO_CLEANUP_ENABLED=true, DEMO_DATABASE_ID e DEMO_IP_HASH_SECRET. Health check /health/ready.
6. Frontend: VITE_API_BASE_URL real, VITE_DEMO_MODE=true; rewrite /* → /index.html. Preencher CSP com origem real da API. Variáveis VITE_ não são secrets.
7. Validar a cadeia de proxy antes de definir TRUST_PROXY_HOPS; provar que IP forjado não evade limite e clientes distintos não compartilham indevidamente o mesmo IP do proxy. Não abrir divulgação pública antes dessa verificação.
8. Exercitar criação, edição, pendência, resolução/reabertura, SLA/timeline, dashboard, 429, CORS, navegação direta/refresh, readiness e persistência após redeploy. Só então adicionar links reais Live Demo/API Health no README.

## Custos e autorizações

Render Static Site e API Free têm quotas; a API dorme após 15 minutos e pode levar cerca de um minuto para acordar. Sem forma de pagamento, esgotamento de determinadas quotas suspende recursos/builds; com cartão, excedentes podem gerar cobrança. Não cadastrar cartão nesta etapa. Neon Free tem quotas de armazenamento/compute; não ativar upgrade. Plano gratuito não garante disponibilidade contínua.

Confirmar separadamente criação/login de conta, termos, acesso GitHub e criação dos três recursos gratuitos. Qualquer pedido de cartão, plano pago ou permissão adicional interrompe o fluxo. Não há URLs públicas confirmadas neste documento.

Documentação oficial: [Render Free](https://render.com/docs/free), [conexão Git](https://render.com/docs/git-provider), [deploys](https://render.com/docs/deploys), [rewrites](https://render.com/docs/redirects-rewrites), [Neon planos](https://neon.com/docs/introduction/plans).
