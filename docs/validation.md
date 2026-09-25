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
