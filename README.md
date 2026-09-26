# Ramon ITOps

Service Desk com acompanhamento de SLA e indicadores operacionais de TI.

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6) ![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.19-43853D) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1)

[Live Demo](https://ramon-itops.onrender.com) · [API Health](https://ramon-itops-api.onrender.com/health) · [Documentation](#documentação)

Demo compartilhada com dados temporários. Use somente dados fictícios; a primeira conexão pode demorar enquanto a API gratuita inicia.

## Funcionalidades

- Incidentes e solicitações com numeração INC/REQ, categoria, prioridade e responsável.
- Fila paginada com filtros; detalhe com histórico, justificativas e datas.
- Pendência, resolução e reabertura com controle de versão contra edição concorrente.
- SLA de resolução 24×7: 24h, 12h, 4h e 1h por prioridade. Pausas e ciclos persistidos.
- Dashboard calculado no PostgreSQL: demanda, backlog, críticos, cumprimento, violações e médias de resolução.
- Filtros de 7 dias, 30 dias e total; população, cobertura e amostra explícitas.
- Health checks separados para processo e prontidão do banco.

As políticas são internas do sistema e não representam um padrão oficial de ITIL.

## Stack

TypeScript, Node.js, Fastify, React, React Router, Vite, PostgreSQL 17, Docker Compose e npm workspaces. Acesso ao banco por SQL parametrizado com `pg`.

## Arquitetura

Frontend → API REST → serviços → repositórios SQL → PostgreSQL.

Chamado, SLA e histórico são persistidos em uma única transação. Migrations versionadas possuem checksum e bloqueio de execução concorrente. O frontend apresenta o SLA calculado no backend.

## Desenvolvimento local

Requisitos: Node.js 22, npm e Docker Desktop com Compose v2 em execução.

```sh
cp .env.example .env
npm ci
npm run db:up
npm run db:migrate
npm run db:seed:demo
npm run dev
```

Copie o exemplo somente na primeira configuração; preserve seu `.env` existente. O seed opcional cria dois técnicos fictícios e nenhum chamado.

- Interface: http://localhost:5173
- API: http://127.0.0.1:3001
- Liveness: http://127.0.0.1:3001/health
- Readiness: http://127.0.0.1:3001/health/ready

O banco fica restrito ao loopback. Se a porta 5432 estiver ocupada, ajuste `POSTGRES_PORT` e a porta de `DATABASE_URL` para o mesmo valor. Não há credenciais de banco no frontend.

## Comandos úteis

| Comando | Finalidade |
| --- | --- |
| `npm run db:up` | Subir PostgreSQL e aguardar health check |
| `npm run db:down` | Parar container preservando volume |
| `npm run db:migrate` | Aplicar migrations pendentes |
| `npm run db:migrate:status` | Consultar estado das migrations |
| `npm run db:seed:demo` | Cadastrar técnicos fictícios |
| `npm run lint` | Verificar código |
| `npm run typecheck` | Verificar tipos |
| `npm test` | Testes unitários e HTTP sem banco |
| `npm run test:integration` | Testes com PostgreSQL dedicado |
| `npm run build` | Compilar todos os workspaces |
| `npm run start -w @ramon-itops/api` | Iniciar API compilada |

Para integração, crie uma vez o banco de testes:

```sh
docker compose exec database createdb -U ramon_itops ramon_itops_test
TEST_DATABASE_URL=postgresql://ramon_itops:local_dev_only@127.0.0.1:5432/ramon_itops_test npm run test:integration
```

Adapte a conexão ao seu `.env`. Os testes exigem banco terminado em `_test`, criam schemas isolados e removem somente esses schemas. Nunca use banco com dados reais. O preview do Vite (`npm run preview -w @ramon-itops/web`) é apenas para verificação local do build.

## API

| Método | Endpoint | Uso |
| --- | --- | --- |
| POST | `/tickets` | Abrir chamado |
| GET | `/tickets` | Listar e filtrar |
| GET | `/tickets/:id` | Detalhe, SLA e histórico |
| PATCH | `/tickets/:id` | Atualizar com versão do registro |
| GET | `/categories`, `/technicians` | Catálogos |
| GET | `/metrics/overview?period=7d\|30d\|all` | Indicadores |
| GET | `/health`, `/health/ready` | Liveness e readiness |

## Estrutura

```text
apps/web/                   Interface e navegação
apps/api/src/modules/       Chamados, SLA e indicadores
packages/database/          Pool, migrations e seed
docs/                       Contratos, decisões e operação
```

## Documentação

- [Arquitetura](docs/architecture.md)
- [Service Desk](docs/service-management.md)
- [Política e fórmulas de SLA](docs/sla.md)
- [API](docs/api.md)
- [Runbook](docs/runbook.md)
- [Ambientes e estratégia de deploy](docs/deployment.md)
- [Proteções e política da demo pública](docs/demo-environment.md)
- [Validação e limitações do ambiente](docs/validation.md)
- [Regras de contribuição](AGENTS.md)

## Roadmap

- Autenticação e perfis de acesso.
- Automação de verificações no GitHub Actions.
- Notificações e avaliação do atendimento.

## Limitações

Sem autenticação, autorização, notificações, calendário comercial ou snapshots históricos de indicadores. A demo pública usa quotas, capacidade limitada e dados temporários por 48 horas, removidos na próxima limpeza. Pode ocorrer cold start. CORS não substitui autenticação nem impede clientes externos.

Use somente dados fictícios. O histórico registra ator de demonstração, não identidade autenticada. Chamados legados têm cobertura parcial explícita e não entram nos indicadores que exigem cobertura integral. Sem licença definida.
