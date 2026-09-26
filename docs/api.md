# API de Service Desk

Base local: http://127.0.0.1:3001. Frontend acessa /api pelo proxy do Vite.

| Método e rota | Resultado |
| --- | --- |
| POST /tickets | 201, chamado com histórico; header Location |
| GET /tickets | 200, items, total, page e page_size |
| GET /tickets/:id | 200, chamado e history |
| PATCH /tickets/:id | 200, chamado atualizado e history |
| GET /categories | 200, catálogo com id e name |
| GET /technicians | 200, técnicos ativos com id e name |
| GET /health | 200, processo da API disponível |
| GET /health/ready | 200 com banco disponível; 503 caso contrário |

## Criação

```json
{
  "title": "Laboratório fictício sem conectividade",
  "description": "Estações de demonstração não acessam a rede local.",
  "type": "incident",
  "category_id": "<UUID retornado por GET /categories>",
  "priority": "high",
  "requester": "Solicitante Demo",
  "technician_id": null
}
```

Tipo: incident/request. Prioridade: low/medium/high/critical. Status: open/in_progress/pending/resolved. O status inicial é sempre open. ID, número, datas, autor do histórico e versão são controlados pelo servidor.

## Listagem

GET /tickets?status=open&priority=high&category_id=UUID&page=1&page_size=20

Filtros são opcionais e combinados por AND. Página padrão 1; tamanho padrão 20, máximo 100. Ordenação por criação decrescente, com ID como desempate. Filtro desconhecido ou inválido retorna 400.

## Atualização

```json
{
  "version": 1,
  "technician_id": "<UUID retornado por GET /technicians>",
  "status": "in_progress"
}
```

Envie somente os campos alterados e a versão lida no detalhe. Campos editáveis: title, description, category_id, priority, technician_id e status. Contexto adicional: pending_reason, resolution_summary ou reopen_reason conforme a transição. A versão é incrementada após alterações reais. Campos desconhecidos são rejeitados.

## Erros

- 400 invalid_input: schema inválido, campo desconhecido ou parâmetro incorreto.
- 404 not_found: chamado inexistente.
- 409 version_conflict: outro atendimento alterou o registro; recarregar e revisar antes de reenviar.
- 422: regra de negócio ou referência inválida; message descreve a ação necessária.
- 503 database_unavailable: falha de disponibilidade reconhecida do banco.
- 500 internal_error: falha inesperada, sem detalhes internos na resposta.

O histórico retorna ação, ator de demonstração, horário, changes com from/to e justificativa quando aplicável. Não há endpoints para editar ou excluir o histórico.

## SLA nos chamados

POST, GET detalhe e PATCH incluem `sla` e `sla_cycles`; GET lista inclui `sla` por item e `calculated_at` na resposta. Nenhum campo de SLA é editável diretamente. Datas são ISO UTC; durações em milissegundos.

- `coverage`: full, partial ou none; `tracking_started_at`, `coverage_label` e `eligible_for_full_coverage_metrics` explicitam a cobertura.
- `state`: in_progress, near_due, breached, met, met_after_reopen ou untracked. `paused` é independente do estado de consumo.
- `label`, `balance_label`, `budget_label`, `consumed_label`: textos calculados no backend para apresentação.
- `budget_ms`, `consumed_ms`, `remaining_ms` (negativo se excedido), `exceeded_ms`, `paused_ms`, `consumed_percent` (pode superar 100).
- `sla_due_at`: null durante pausa; `paused_at`, `breached_before_pause` preservam o contexto. Ex.: “SLA pausado — 2h30 restantes” ou “SLA pausado — violado em 30 min”.
- `cycle_number`, `start_reason`, `policy_version`, `started_at`, `ended_at`, `result` e `previous_breached_cycles` permitem interpretar resolução e reabertura.
- `sla_cycles` inclui todos os ciclos e seus intervalos `pauses`, com `started_at`, `ended_at` e `breached_on_entry`. Sem cobertura, os campos de duração/ciclo não existem; a interface não deve tratá-los como zero.

O frontend formata datas e apresenta textos; não classifica SLA por relógio próprio. Atualização a cada 60 segundos enquanto a página está visível, além da consulta manual. A atualização do painel de SLA não sobrescreve um formulário de edição em andamento.

## GET /metrics/overview

Query `period=7d|30d|all`, padrão 30d. Parâmetros desconhecidos retornam 400. Não aceita timestamp fornecido pelo cliente.

Resposta: `period`, `from` (null para total), `to`, `calculated_at`, `distribution_population`, `backlog_scope` e:

| Grupo | Campos |
| --- | --- |
| tickets | created_in_period, resolved_in_period |
| operations | backlog, critical_open, average_total_resolution_minutes, total_resolution_sample, average_effective_resolution_minutes, effective_resolution_sample |
| sla | met, breached, eligible, compliance_rate, excluded_partial, excluded_untracked, partial_results.met, partial_results.breached |
| distributions | priority, category, status: arrays de {name, count} |

Percentuais/médias sem amostra são null; contagens ausentes são zero. Distribuições consideram estado ATUAL dos chamados CRIADOS no período. Backlog/críticos abrangem todas as datas. Resoluções consideram última resolução dos atualmente resolvidos; cobertura parcial/ausente é excluída dos KPIs comparáveis. Fórmulas e limitações em [sla.md](sla.md).

## Hospedagem

Endpoints permanecem iguais. Em produção, a URL base é a API HTTPS hospedada, configurada no frontend por VITE_API_BASE_URL. CORS permite apenas origens exatas em CORS_ORIGINS, métodos GET/HEAD/POST/PATCH/OPTIONS e Content-Type. Não usa cookies nem substitui autorização.
