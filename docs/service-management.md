# Gestão de serviços: escopo e decisões

## Objetivo

Dar rastreabilidade ao atendimento e visibilidade operacional, conectando registros de suporte com qualidade do serviço. São diretrizes para implementação futura, não funcionalidades já disponíveis.

## Tipos e organização

Distinguir incidente (interrupção ou degradação) de solicitação de serviço. Categorias iniciais propostas: acesso, estações de trabalho, rede, sistemas e infraestrutura. Cada chamado terá identificador, descrição, categoria, prioridade, responsável e datas auditáveis.

Prioridades: baixa, média, alta e crítica. A prioridade deve refletir impacto e urgência; a matriz e os critérios concretos serão definidos na Fase 2. “Crítica” não será apenas uma cor: deverá representar impacto operacional relevante.

## Status propostos

- Aberto: registrado e aguardando triagem ou início do atendimento.
- Em atendimento: técnico atua na demanda.
- Pendente: atendimento aguarda dependência identificada; motivo obrigatório.
- Resolvido: solução registrada e data de resolução definida.

Mudanças de status, prioridade e responsável devem gerar histórico com valor anterior, novo valor, horário e autor. Reabertura e correção de resolução precisam de regra explícita antes da implementação.

## SLA: decisões obrigatórias antes de calcular

Definir prazos por prioridade, primeira resposta versus resolução, horário corrido ou comercial, fuso horário, calendário, feriados, pausas em pendência e comportamento na reabertura ou mudança de prioridade. Não adotar pausa automática em Pendente sem política documentada. Não apresentar percentual de SLA enquanto essas regras estiverem indefinidas.

## Indicadores propostos

- Volume: chamados abertos no período, com intervalo e fuso explícitos.
- Backlog: chamados não resolvidos no instante de referência.
- Críticos: chamados críticos não resolvidos.
- Tempo médio de resolução: duração dos chamados resolvidos no período, conforme política de pausas.
- SLA cumprido: proporção de chamados elegíveis resolvidos dentro do prazo; sem elegíveis, mostrar “sem dados”, não 100%.

Histórico deve permitir explicar como cada número foi calculado. CSAT mede satisfação com o atendimento; NPS mede recomendação e exige interpretação própria. Ambos ficam fora da Fase 1.
