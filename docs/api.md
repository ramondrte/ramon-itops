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
