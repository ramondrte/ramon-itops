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
