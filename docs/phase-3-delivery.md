# Entrega da Fase 3 — SLA e governança

## Implementado

SLA 24×7 (Baixa 24h, Média 12h, Alta 4h, Crítica 1h), pausa persistente, prioridade descontando consumo, resolução congelada e novo ciclo por reabertura. Legados ativos com timestamp real e cobertura parcial; resolvidos anteriores sem retroatividade. SLA calculado no backend; chamado, ciclos, pausas e histórico em transação com controle de versão.

## Migrations

- 004_create_sla_tracking.sql: ciclos, pausas e restrições.
- 005_initialize_existing_ticket_sla.sql: ativação dos legados e rastreabilidade.
- 006_add_metrics_indexes.sql: índices de resoluções e ciclos encerrados.

## API e indicadores

Novo GET /metrics/overview?period=7d|30d|all. Endpoints de chamados expõem SLA; detalhe/criação/atualização também retornam ciclos e pausas.

Indicadores: criados e resolvidos no período; backlog atual; críticos ativos; cumprimento e violações de SLA; média total e média efetiva; distribuições de prioridade, categoria e status atuais dos chamados criados no período. Cobertura, exclusões e amostras explícitas. Sem amostra, médias e percentual são null.

## Commits da entrega (14)

1. docs: definir política de SLA e contrato de indicadores
2. feat(database): adicionar ciclos pausas e cobertura de SLA
3. feat(api): implementar motor persistente de SLA
4. feat(api): integrar SLA ao ciclo de vida dos chamados
5. feat(api): calcular indicadores operacionais no PostgreSQL
6. feat(api): registrar indicadores e relógio controlável
7. test(api): validar SLA indicadores e regressões do Service Desk
8. feat(web): adicionar contratos de SLA e indicadores
9. feat(web): apresentar ciclos pausas e cobertura de SLA
10. feat(web): exibir SLA na fila e no detalhe do chamado
11. feat(web): criar dashboard de governança com períodos e amostras
12. style(web): integrar apresentação corporativa da Fase 3
13. docs: registrar arquitetura validação e operação da Fase 3
14. docs: atualizar portfólio e entrevista da Fase 3

## Validação e limites

Lint, typecheck, 6 testes unitários, 14 testes reportados na integração (inclui agrupador), build e git diff --check passaram. PostgreSQL real, testes de limites temporais/concorrência/rollback/legados e reinício real com SLA pausado. Validação visual da fila, detalhe e dashboard.

Docker não está funcional neste computador; execução específica do container não validada. Sem autenticação, notificações, calendário comercial, snapshots históricos ou identidade autenticada no histórico. Atualização visual periódica de 60 segundos; o backend é a fonte de verdade. Indicadores de resolução refletem o estado atual e último ciclo, não relatório histórico imutável. Dados locais exclusivamente fictícios.

## Demonstração em entrevista

1. Abra um incidente e explique prioridade e orçamento interno, sem alegar padrão ITIL.
2. Coloque em Pendente; mostre saldo congelado, timestamp e motivo na timeline.
3. Retome e resolva; reabra e confira novo ciclo e preservação do resultado anterior.
4. Mostre o legado com cobertura parcial e explique sua exclusão dos KPIs comparáveis.
5. No dashboard, explique população, denominador, amostra e diferença entre tempo total e efetivo. Não afirme tendência a partir de um retrato.
6. Demonstre nos testes o relógio controlável, conflito 409 e rollback atômico.

Isso evidencia gestão de SLA, governança operacional, monitoramento de desempenho, análise de backlog, rastreabilidade, pendência, consistência transacional e interpretação responsável dos dados.
