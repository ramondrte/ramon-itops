# Ramon ITOps

**Service Desk e operações de TI — projeto de portfólio com foco em suporte, infraestrutura, NOC e governança.**

O Ramon ITOps organiza incidentes e solicitações com persistência em PostgreSQL, responsáveis e histórico de atendimento. A evolução é incremental: primeiro a saúde do ambiente, depois o processo de Service Desk e, futuramente, SLA e indicadores de governança.

## Fase 2 — Service Desk

- Abertura de incidentes e solicitações com números INC/REQ.
- Fila de chamados com filtros combinados por status, prioridade e categoria, além de paginação.
- Detalhe com contexto, datas, técnico responsável e timeline de alterações.
- Atendimento, pendência com motivo, resolução com solução e reabertura justificada.
- Gravação transacional de chamado e histórico; proteção contra edição concorrente.
- PostgreSQL com migrations SQL versionadas e verificação de checksum.
- Health checks da Fase 1 preservados.

Incidente representa interrupção ou degradação de serviço; solicitação representa um pedido padrão. O projeto utiliza conceitos de gestão de serviços, sem alegar conformidade formal com ITIL.

## Executar localmente

Pré-requisitos: Node.js 22, npm e Docker com Compose v2.

```sh
cp .env.example .env
npm ci
npm run db:up
npm run db:migrate
npm run db:seed:demo
npm run dev
```

O seed é opcional e cadastra apenas dois técnicos fictícios. Nenhum chamado é criado automaticamente. Para percorrer atribuição, atendimento e resolução, use os técnicos de demonstração.

- Interface: http://localhost:5173/tickets
- Saúde da API: http://127.0.0.1:3001/health
- Prontidão do banco: http://127.0.0.1:3001/health/ready

O Compose e a API leem `.env` na raiz. As credenciais de `.env.example` são exclusivamente locais. Se alterar usuário, senha ou nome do banco, ajuste também `DATABASE_URL`. O frontend usa um proxy e não recebe credenciais do banco.

```sh
npm run db:migrate:status
npm run lint
npm run typecheck
npm test
npm run build
```

Para testar as regras com PostgreSQL real, crie um banco dedicado (apenas na primeira execução):

```sh
docker compose exec database createdb -U ramon_itops ramon_itops_test
TEST_DATABASE_URL=postgresql://ramon_itops:local_dev_only@127.0.0.1:5432/ramon_itops_test npm run test:integration
```

Adapte o usuário e a conexão se tiver alterado o exemplo. O teste exige nome de banco terminado em `_test`, cria um schema isolado por execução, aplica as migrations e remove somente esse schema ao encerrar. Nunca aponte testes para bancos com dados reais.

Para verificar a versão compilada, execute `npm run start -w @ramon-itops/api` e, em outro terminal, `npm run preview -w @ramon-itops/web`. O preview é local, não uma configuração de produção.

## Estrutura

```text
apps/web                      React, navegação, fila, abertura e detalhe
apps/api/src/modules/tickets  Rotas, schemas, serviços e repositório
packages/database             Pool, transações, migrations e seed
docs/                        Arquitetura, regras, API e runbook
```

Um monorepo com npm workspaces, TypeScript e um lockfile. SQL parametrizado com `pg`, sem ORM, microsserviços ou arquitetura distribuída.

## Documentação

- [Arquitetura e decisões técnicas](docs/architecture.md)
- [Regras de Service Desk](docs/service-management.md)
- [Contrato REST](docs/api.md)
- [Runbook e recuperação](docs/runbook.md)
- [Validação e limitações](docs/validation.md)
- [Regras de contribuição](AGENTS.md)

## Como apresentar em entrevista

“Implementei um fluxo de Service Desk que diferencia incidentes de solicitações e exige contexto nas etapas de pendência, resolução e reabertura. Cada mudança é persistida junto do histórico em uma transação, e a versão do registro evita perda de atualizações simultâneas.”

| Competência | Evidência no projeto |
| --- | --- |
| Operação de Service Desk | Fila filtrável, prioridade, categoria e responsável |
| Rastreabilidade | Timeline com valores anteriores/novos e justificativas |
| Incidentes e solicitações | Tipos distintos e identificação INC/REQ |
| Organização de processo | Regras de transição e solução obrigatória |
| Persistência de dados | PostgreSQL, migrations, transações e testes de rollback |
| Visão operacional | Health checks, diagnóstico e documentação de recuperação |

Como ainda não há autenticação, o histórico identifica “Operador de demonstração” e não comprova a identidade de uma pessoa. Essa limitação deve ser explicada na apresentação.

## Roadmap e limites

- Fase 1: base operacional e saúde dos serviços.
- Fase 2: Service Desk e histórico persistente.
- Próxima fase: definição e implementação de SLA e indicadores reais.
- Evoluções futuras: autenticação, perfis, notificações, GitHub Actions e satisfação.

SLA, autenticação e notificações não estão implementados. A visão geral mantém métricas futuras como “Planejado · sem dados”. Sem exclusão de chamados ou cadastro administrativo de técnicos nesta fase.

Ambiente de desenvolvimento vinculado ao localhost. Use apenas dados fictícios; não inclua senhas, chamados reais ou informações corporativas. Nenhuma licença foi escolhida.
