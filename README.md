# Ramon ITOps

**Service Desk, SLA e governança de TI — projeto de portfólio em desenvolvimento.**

O Ramon ITOps demonstra como práticas de suporte e operação podem orientar um produto: visibilidade de serviço, diagnóstico, rastreabilidade de atendimento e indicadores com regras documentadas.

## Estado atual: Fase 1

- Frontend React/TypeScript com visão operacional e consulta real de saúde.
- API Node.js/Fastify com logs estruturados e endpoints de disponibilidade e prontidão.
- PostgreSQL local via Docker Compose, volume persistente e health check.
- Teste de falha e recuperação de dependência, lint, tipos e build.
- Runbook de diagnóstico e documentação de arquitetura.

Os indicadores de chamados são espaços reservados, sem dados simulados. Gestão de chamados e cálculo de SLA ainda não foram implementados. A interface não é um sistema de monitoramento contínuo: consulta ao abrir e ao atualizar manualmente.

## Executar localmente

Pré-requisitos: Node.js 22 (arquivo `.nvmrc`), npm e Docker com Compose v2.

```sh
cp .env.example .env
npm ci
npm run db:up
npm run dev
```

Abra http://localhost:5173. API: http://127.0.0.1:3001/health. Prontidão: http://127.0.0.1:3001/health/ready.

O Compose carrega `.env` da raiz. A API também carrega esse arquivo; o frontend recebe apenas o endereço do proxy, nunca credenciais do banco. Se mudar usuário, senha ou nome do banco, ajuste também `DATABASE_URL`. Credenciais do exemplo são somente para desenvolvimento local.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Para verificar a versão compilada, execute `npm run start -w @ramon-itops/api` e, em outro terminal, `npm run preview -w @ramon-itops/web`. O preview é local, não uma configuração de produção.

Para encerrar, use Ctrl+C nas aplicações e `npm run db:down`. O volume de dados é preservado.

## Organização

```text
apps/web             Interface operacional React + Vite
apps/api             API Fastify e health checks
packages/database    Pool PostgreSQL compartilhado
docs/               Arquitetura, regras de serviço e runbook
```

Um repositório, npm workspaces e um lockfile. Sem orquestrador adicional, ORM ou microsserviços nesta etapa.

## Roadmap

1. **Fundação:** ambiente reproduzível, documentação e saúde dos serviços.
2. **Service Desk:** incidentes e solicitações, categorias, prioridade, responsável, status e histórico.
3. **SLA e governança:** regras de prazo, backlog, chamados críticos, tempo médio de resolução e cumprimento de SLA.
4. **Evoluções:** autenticação e perfis, automação com GitHub Actions e satisfação (CSAT/NPS, com conceitos distintos).

## Documentação

- [Arquitetura](docs/architecture.md)
- [Regras de gestão de serviços](docs/service-management.md)
- [Runbook operacional](docs/runbook.md)
- [Validação da entrega](docs/validation.md)
- [Orientações de contribuição](AGENTS.md)

## Como apresentar em entrevista

“Estruturei uma plataforma de operações de TI começando pela confiabilidade do ambiente. Diferenciei processo ativo de serviço pronto para uso, tratei indisponibilidade do banco, documentei diagnóstico e preparei a evolução para histórico de atendimento e métricas de SLA.”

A Fase 1 comprova fundamentos de suporte, infraestrutura e NOC; o roadmap conecta essas bases a ITSM e governança. O projeto usa conceitos de gestão de serviços, sem alegar certificação ou conformidade formal com ITIL.

## Limites

Ambiente local de estudo, sem autenticação ou configuração de implantação em produção. Não insira dados pessoais, chamados reais, tokens ou credenciais corporativas. Os serviços ficam vinculados ao localhost. Nenhuma licença de uso foi escolhida nesta fase.
