# Publicação Render + Neon — 26/09/2026 UTC

Aplicação: https://ramon-itops.onrender.com. API: https://ramon-itops-api.onrender.com. Serviços gratuitos, API e Neon na Virgínia; frontend em CDN global. Node.js 22 no Render, PostgreSQL 17 no Neon. Sem cartão, upgrade, dados reais ou dependência da máquina local. Painel Render conferido: workspace Hobby, nenhum cartão cadastrado e custo atual US$ 0,00.

## Banco e publicação

- Primeira preparação controlada executou migrations, status, seed e vínculo de demo antes da API atender. `db:migrate:status` confirmou 001_create_service_desk, 002_create_ticket_history, 003_seed_categories, 004_create_sla_tracking, 005_initialize_existing_ticket_sla, 006_add_metrics_indexes e 007_create_demo_controls como applied.
- Seed cadastrou apenas dois técnicos fictícios. Os chamados de validação foram criados pela API pública.
- Conexão runtime/migration exigiu TLS verify-full. Readiness retornou 200 com database up. Credenciais somente no painel, nunca no repositório ou frontend.
- Comandos administrativos foram removidos do build após bootstrap; build/start normais não executam migrations. Deploy automático desligado.
- HTTPS, CORS com origem exata, CSP do frontend com origem real, cabeçalhos de segurança e rewrite SPA configurados e conferidos por respostas HTTP.

## Testes públicos

- Duas rodadas do fluxo com dados fictícios: criação, atribuição, atendimento, prioridade crítica, pendência, retomada, resolução, reabertura e nova resolução. Cada rodada passou 19 verificações HTTP incluindo saúde, detalhe, filtros, indicadores 7d/30d/all, conflito 409 e CORS.
- Detalhe registrou dois ciclos de SLA e nove eventos. Durante pendência: saldo congelado, pausa persistida e sla_due_at null. Depois de reabrir/resolver: resultado met_after_reopen e preservação do primeiro ciclo.
- Dashboard público exibiu dados reais e amostra; fila e detalhe carregaram após acesso direto e refresh no navegador.
- CORS: preflight PATCH autorizado retornou 204 e origem exata; escrita com origem não autorizada retornou 403.
- Rate limit inicial: 30 tentativas inválidas de PATCH retornaram 400 e a 31ª retornou 429 com Retry-After. Após restaurar o comando normal e configurar proxy, variar o prefixo X-Forwarded-For em cada tentativa não burlou a quota; retorno 429 preservado.
- Persistência após redeploy: ID, versão, estado, histórico e campos dos dois ciclos permaneceram idênticos. Somente calculated_at, campo derivado da consulta, mudou.

## Diagnóstico temporário do proxy

Com autorização explícita, o comando de início foi temporariamente substituído por uma inicialização equivalente com log agregado para sondas no health. Não houve alteração em regra de negócio, schema ou endpoint de aplicação. O registro continha apenas contagem de saltos, índices e booleanos, sem IPs de visitantes ou segredos.

Cadeia normal: três entradas X-Forwarded-For, visitante na posição 2 a partir da direita. Prefixo forjado: quatro entradas, visitante continuou na posição 2 e o prefixo ficou na posição 3. Cabeçalho CF-Connecting-IP forjado foi bloqueado pela borda com 403. Configuração resultante: TRUST_PROXY_HOPS=3. Comando final restaurado: `npm run start -w @ramon-itops/api`, redeploy concluído e fluxo/health/rate limit testados novamente.

## Cold start

Após mais de 16 minutos sem consultas da validação e sem abas públicas atualizando, a primeira consulta HTTPS ao readiness levou 23,428 segundos e retornou 200, status ready e database up em 26/09/2026 às 04:16:27 UTC. O frontend exibiu a mensagem de serviço iniciando durante a retomada. Em seguida /health retornou 200 e o chamado anterior manteve versão e histórico. Esse tempo é uma observação, não um SLA garantido do provedor.

## Regressão local

Após configuração pública: lint, typecheck, 11 testes unitários/HTTP, build, 20 resultados de integração com PostgreSQL Docker em banco de testes e git diff --check passaram. Regras de negócio e migrations existentes não foram alteradas nesta publicação.

## Limites da evidência

Não houve teste de carga/DDoS, nem comparação simultânea de dois visitantes em redes independentes. A confiança por número de saltos exige revalidação se a topologia mudar. A limpeza de 48h foi testada com relógio controlável local; não aguardamos 48h no serviço público. Demo sem autenticação, com dados compartilhados e temporários; quotas e cold start impedem promessa de disponibilidade contínua. Logs próprios dos provedores seguem suas políticas.

As seções abaixo preservam os registros históricos de cada etapa.

---

# Preparação da demo pública — 26/09/2026 UTC

Preparação local concluída; nenhum recurso Render/Neon foi criado. Não há URLs públicas validadas nesta etapa.

- Lint, typecheck, 11 testes unitários/HTTP, build e 20 resultados de integração (inclui agrupador) passaram.
- PostgreSQL real no container de validação, porta 55432; testes em schemas isolados do banco de testes. Migration 007 aplicada somente nesses schemas nesta etapa.
- Limites por IP/rede IPv6, janelas persistidas, teto global, capacidade concorrente, HTTP 429 e Retry-After verificados.
- Headers, body size, erros seguros, CORS, spoofing de IP com proxy desabilitado e com um salto controlado, health/readiness verificados.
- Limpeza seletiva após 48 horas, limite exato, rollback, vínculo incorreto de banco e preservação dos dados não marcados testados com relógio controlável. Nenhuma limpeza executada nos bancos de desenvolvimento.
- Fluxo demo: criação, prioridade, atendimento, pendência/retomada, resolução/reabertura, SLA, timeline, filtros e indicadores. Proteções persistidas recuperadas em nova conexão.
- Frontend: teste de retomada de leitura após falha temporária, escrita sem repetição automática e mensagem de 429. Aviso visual e detalhe com SLA conferidos no navegador local.
- Template Render analisado como YAML. Migrations antigas e motor de SLA preservados; hooks da demo participam da transação de criação existente.

## Validação externa ainda pendente

Após autorização: TLS Neon, migrations/seed/vínculo no banco dedicado, configuração real de proxy/IP, CSP com origem definitiva, CORS entre serviços, refresh das rotas na hospedagem, reinício/redeploy e URLs HTTPS. Os testes locais não substituem essas verificações. A limpeza exige produção, modo demo, habilitação explícita e vínculo com banco dedicado; permanece desligada no desenvolvimento.

---

# Validação de polimento e ambiente — 26/09/2026 UTC

## Estado atual

Docker Desktop 4.92.0 instalado do DMG oficial Apple Silicon, assinatura verificada; Engine 29.8.0 e Compose 5.5.1 funcionais. A abertura reutilizou o estado existente do Docker e não apresentou senha, Touch ID ou aceite de termos. Nenhum container preexistente foi alterado.

PostgreSQL 17.11 via postgres:17-alpine, projeto Compose ramon-itops-validation, porta 127.0.0.1:55432 e volume próprio. Banco anterior na porta 5432 preservado, assim como o .env local. A cópia de .env.example não foi executada sobre o arquivo existente; os valores da validação foram passados pelo ambiente.

## Executado

- npm ci: instalação reproduzível, audit sem vulnerabilidades reportadas.
- npm run db:up com POSTGRES_PORT=55432 e COMPOSE_PROJECT_NAME=ramon-itops-validation: saudável.
- db:migrate: seis migrations aplicadas; db:seed:demo: técnicos fictícios cadastrados.
- npm run dev com API_PORT=3002, WEB_PORT=5174 e DATABASE_URL do container: frontend, proxy e API operantes; health/ready 200.
- 8 testes unitários/HTTP, incluindo configuração de produção e preflight CORS PATCH com origem exata.
- 14 resultados de integração no PostgreSQL do container (inclui agrupador), preservando testes funcionais existentes.
- Restart do container, espera de health check e leitura do mesmo chamado fictício: histórico, consumo, saldo, pausa e ciclo idênticos. API recuperada sem reinício.
- Lint, typecheck, build e git diff --check.
- Navegador: sidebar compacta, status reais e atalho de SLA preservando filtro temporal; aplicação conectada ao container.

Migrations existentes, motor de SLA, serviços/repositórios de negócio e testes funcionais não foram alterados. O novo teste trata somente configuração e CORS. .env e dados locais não foram publicados.

## Limitações

Não houve deploy público, conta, OAuth ou cobrança. TLS do banco remoto e integração com uma hospedagem serão validados quando o provedor for autorizado. Não foi adicionada autenticação ou limitação de escrita anônima. Node.js de execução local: 20.20.2; a documentação recomenda 22.

As seções abaixo são registros históricos; a limitação de Docker relatada nelas foi resolvida nesta validação.

---

# Validação da Fase 3 — 25/09/2026 (horário local)

Ambiente preservado: PostgreSQL 17.6 real, Node.js 20.20.2, npm 10.8.2, macOS ARM64. Sem novas dependências de aplicação.

- 6 testes unitários: saúde, orçamentos, crítico, limites exatos, pausa, violação pausada e congelamento/reabertura.
- 14 testes de integração reportados pelo runner (inclui o agrupador Service Desk): regressões da Fase 2 e cinco cenários amplos de SLA/indicadores. Todos passaram.
- Relógio injetável, sem esperas reais: 1h30 consumida + 3h pausada → 2h30 restante; resolução no limite; orçamento alterado sem reset; violação anterior à pausa; resolução pausada; reabertura com ciclo anterior preservado.
- Indicadores SQL testados com valores exatos, janelas 7/30 dias/total, limites inclusivos, backlog antigo, nulos sem amostra e exclusão de legados.
- Migration de legados testada a partir do schema da Fase 2: ativos parciais e resolvidos sem retroatividade, inclusive após reabertura.
- Concorrência 200/409 e rollback de chamado/SLA/histórico; criação revertida sem ciclo órfão.
- Nova conexão e nova instância da API recuperam o SLA persistido. Reinício real do PostgreSQL local com chamado em Pendente confirmou igualdade de consumed_ms, remaining_ms, paused_at e cycle_number; recuperação sem reiniciar API.
- Navegador: dashboard com contagens reais e ausência de amostra, gráficos com população explícita; fila e detalhe mostram timestamp real do legado e cobertura parcial; pausa salva pela interface mostrou saldo congelado e histórico.
- Lint, typecheck, testes unitários, integração e build executados antes da publicação.

Docker continua indisponível: não foi validada a execução específica do container. Os testes usam PostgreSQL real em schema isolado de banco _test. Demonstrações locais utilizam somente dados fictícios; cenários de violação com timestamps controlados não alimentam o dashboard de demonstração.

---

# Validação da Fase 2 — 25/09/2026

Ambiente: macOS ARM64, Node.js 20.20.2, npm 10.8.2 e PostgreSQL 17.6 real. Node.js 22 continua sendo a versão recomendada do projeto.

## Verificações concluídas

- Migrations aplicadas em banco real; segunda execução sem reaplicação; execução concorrente serializada; alteração de checksum rejeitada.
- Criação, numeração INC/REQ e unicidade em criações concorrentes.
- Validação de campos, categorias, UUIDs, filtros combinados e paginação.
- Responsável obrigatório em atendimento; motivo de pendência e solução obrigatórios.
- Resolução e reabertura preservando histórico; retorno indevido para Aberto rejeitado.
- Alterações sem efeito sem incremento de versão ou evento extra.
- Duas edições simultâneas: uma aceita e outra rejeitada com 409.
- Falha na escrita do histórico: criação e atualização revertidas por transação.
- Health checks preservados.
- Lint, typecheck, testes e build executados com sucesso.

## Navegador e recuperação

Percorrido o fluxo real de abertura de incidente, atribuição, atendimento, pendência, resolução e reabertura. Registrada também uma solicitação fictícia para conferir prefixo REQ. Conferidos filtros combinados, datas, categoria preservada e timeline.

Após desligar PostgreSQL: /health retornou 200, /health/ready e /tickets retornaram 503. Após reiniciar: prontidão voltou a 200 sem reiniciar a API; os dois chamados de demonstração e os cinco eventos do incidente permaneceram persistidos.

## Limites da verificação

Docker continua indisponível no computador. Para esta validação, um runtime PostgreSQL 17.6 foi instalado apenas na pasta de trabalho, fora do repositório, usando embedded-postgres. Não é dependência do projeto nem substitui o Docker Compose documentado. Migrations, transações e recuperação foram testadas com PostgreSQL real; a execução específica do container e do volume Docker ainda não foi validada aqui.

O seed versionado cria somente técnicos fictícios. Os dois chamados do teste visual existem apenas no banco local de demonstração, sem dados reais ou inserção automática ao iniciar.

---

# Validação da Fase 1

Validação local em 25/09/2026, macOS, Node.js 20.20.2 e npm 10.8.2. O projeto recomenda Node.js 22 e declara compatibilidade a partir de 20.19.

## Executado com sucesso

- Instalação das dependências e geração de package-lock.json.
- npm run lint.
- npm run typecheck.
- npm test: teste de integração das rotas com Fastify.inject e dependência de banco controlada. Verifica liveness independente, readiness 503, recuperação 200, não exposição do erro, rota inexistente e fechamento da dependência.
- npm run build: database, API e frontend.
- Aplicação em desenvolvimento: GET /health retornou 200; GET /health/ready retornou 503 com o banco ausente.
- Proxy do frontend: /api/health retornou 200.
- Navegador: interface carregou e mostrou API disponível e banco indisponível, com indicadores futuros identificados como sem dados.

## Pendente por limitação do ambiente

Docker não está funcional neste computador. Não foram executados docker compose up, health check do container, persistência do volume ou recuperação com PostgreSQL real. O teste automatizado de recuperação usa uma dependência controlada e não substitui esse exercício.

Execute o procedimento de indisponibilidade em runbook.md após instalar/iniciar Docker. A Fase 1 tem sua implementação disponível, mas a validação integrada com PostgreSQL permanece pendente.
