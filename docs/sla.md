# Política de SLA — resolução 24×7, versão 1

Política interna de demonstração do Ramon ITOps, sem pretensão de padrão ou conformidade oficial com ITIL. Incidentes e solicitações seguem a mesma política nesta fase.

| Prioridade | Orçamento |
| --- | --- |
| Baixa | 24 horas |
| Média | 12 horas |
| Alta | 4 horas |
| Crítica | 1 hora |

## Relógio e limites

Horas corridas 24×7, sem calendário comercial. Tempo consumido = (fim do ciclo ou instante da consulta − início do ciclo) − soma das pausas. Saldo = orçamento vigente − consumo. O backend utiliza um instante por operação; datas são UTC/ISO, exibidas no fuso do navegador. Nenhum timestamp de cálculo é aceito do frontend.

Próximo do vencimento: 0 ≤ saldo ≤ 20% do orçamento vigente. Violado: consumo > orçamento. Resolver exatamente no limite cumpre o SLA. Arredondamento é apenas apresentação, nunca classificação. Não há eventos automáticos de timeline apenas pelo tempo passar: a classificação é calculada na consulta.

## Pendência

Pendente abre uma pausa persistida. A retomada fecha a pausa. Resolver diretamente de Pendente fecha a pausa sem consumir esse intervalo. Atualizar dados sem mudar o status não reinicia a pausa. Reinícios da aplicação não alteram o cálculo.

Durante a pausa, sla_due_at é null. A API expõe orçamento, consumo, saldo congelado, percentual consumido, início da pausa, tempo excedido e breached_before_pause. O último campo registra se o SLA estava violado ao entrar na pausa, mesmo se a prioridade for alterada depois. O indicador atual reflete o orçamento vigente.

Exemplo: Alta, 4h de orçamento, 1h30 consumida e 3h em Pendente → 2h30 restantes na retomada.

## Prioridade

O novo orçamento é o da nova prioridade, descontando todo o consumo efetivo do ciclo. Não há reset. Elevar de Alta para Crítica após 90 minutos deixa 30 minutos de atraso. Reduzir a prioridade pode devolver prazo; a timeline registra o orçamento anterior/novo e a situação resultante. O resultado final é avaliado pela prioridade vigente na resolução.

## Resolução e reabertura

Resolver congela orçamento, consumo final e resultado do ciclo. Reabrir cria outro ciclo com orçamento completo da prioridade vigente, preservando integralmente os anteriores. O intervalo resolvido não consome SLA. Um ciclo pode ser cumprido após reabertura sem apagar uma violação anterior. A cobertura integral do chamado não é restaurada artificialmente pela reabertura de um chamado legado.

## Cobertura

Chamados criados após a ativação têm cobertura desde a criação. Chamados ativos existentes começam a contar no timestamp real da migration, com rótulo “SLA acompanhado desde … — cobertura parcial”. Se já estiverem pendentes, a pausa começa nesse mesmo instante, sem inventar tempo anterior.

Chamados resolvidos antes da implantação ficam sem SLA registrado. Ao reabrir, recebem um ciclo, mas permanecem com cobertura parcial do histórico completo. Chamados parciais ou sem SLA são excluídos do percentual principal de cumprimento, contagem principal de violações resolvidas e média efetiva comparável. As exclusões são informadas, com resultados parciais em grupo separado. A média total de resolução usa timestamps reais de todos os resolvidos elegíveis pelo período, independentemente de cobertura.

## Indicadores

Períodos: últimas 7×24h, últimas 30×24h ou total até calculated_at (limites inclusivos). Demanda: chamados criados nesse intervalo. Gráficos: prioridade/categoria/status ATUAIS dos chamados CRIADOS no período, não fotografia histórica da abertura.

Backlog atual = status diferente de Resolvido, em todas as datas. Críticos ativos = backlog com prioridade Crítica. Esses cartões não dependem do filtro temporal.

Resoluções do período = chamados atualmente resolvidos cuja última resolved_at está no intervalo. Cada chamado entra uma vez, com resultado do último ciclo. Reabertura retira o chamado desse conjunto até nova resolução; esta é uma leitura do estado atual, não um relatório histórico imutável.

Cumprimento = 100 × cumpridos com cobertura integral / (cumpridos + violados com cobertura integral). Sem elegíveis: null, apresentado como “Sem dados”. Violados = quantidade dos elegíveis com resultado breached. Sem SLA e cobertura parcial aparecem como exclusões, nunca como cumprimento.

Tempo médio total = média(resolved_at − created_at), em minutos. Inclui pendências e intervalos resolvidos anteriores à última resolução. Tempo médio efetivo comparável = média(soma dos consumos dos ciclos por chamado), somente com cobertura integral; exclui pendências e intervalos resolvidos. Não mede horas trabalhadas pelo técnico: inclui espera em Aberto e Em atendimento. Não usamos MTTR como sinônimo para essas duas médias.

## Limitações e interpretação

Sem autenticação, notificações, calendário comercial, snapshots históricos ou relatórios imutáveis. A timeline é rastreabilidade funcional, não identidade comprovada. A indisponibilidade da aplicação não pausa o SLA: apenas Pendente pausa.

Violações, backlog, criticidade, categorias e médias apoiam investigação operacional. Não afirmar tendência ou crescimento com um único retrato. Amostras pequenas e exclusões devem acompanhar a interpretação. Valores zero representam ausência de ocorrências; percentual ou média sem amostra são null.
