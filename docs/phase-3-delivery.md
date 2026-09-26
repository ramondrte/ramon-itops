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

## Validação e limites

Lint, typecheck, 6 testes unitários, 14 testes reportados na integração (inclui agrupador), build e git diff --check passaram. PostgreSQL real, testes de limites temporais/concorrência/rollback/legados e reinício real com SLA pausado. Validação visual da fila, detalhe e dashboard.

Docker não está funcional neste computador; execução específica do container não validada. Sem autenticação, notificações, calendário comercial, snapshots históricos ou identidade autenticada no histórico. Atualização visual periódica de 60 segundos; o backend é a fonte de verdade. Indicadores de resolução refletem o estado atual e último ciclo, não relatório histórico imutável. Dados locais exclusivamente fictícios.
