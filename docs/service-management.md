# Regras de Service Desk — Fase 2

## Incidente e solicitação

Incidente é interrupção ou degradação de um serviço. Solicitação é um pedido padrão, como acesso ou instalação. Ambos compartilham o fluxo de atendimento, com prefixos INC e REQ. Tipo e solicitante são definidos na abertura e não podem ser alterados pelo PATCH nesta fase.

## Cadastro

Título: 5–160 caracteres; descrição: 10–10.000; solicitante: 2–100. Espaços externos são removidos. Prioridade e categoria são obrigatórias. Responsável é opcional na abertura; apenas técnicos ativos podem ser atribuídos.

Categorias: Acesso e credenciais; Hardware; Software; Rede e conectividade; Sistemas corporativos; E-mail; Outros.

## Prioridade

Escolha manual na triagem, considerando impacto e urgência. Orientações de demonstração, sem cálculo automático ou SLA:

- Baixa: impacto limitado e sem urgência.
- Média: atendimento necessário, com alternativa disponível.
- Alta: impacto relevante e necessidade de atuação rápida.
- Crítica: serviço essencial interrompido, impacto amplo e sem alternativa.

## Transições

| Origem | Destino permitido | Condição |
| --- | --- | --- |
| Aberto | Em atendimento | Técnico atribuído |
| Aberto / Em atendimento | Pendente | Técnico e motivo de pendência |
| Aberto / Em atendimento / Pendente | Resolvido | Técnico e resumo da solução |
| Pendente | Em atendimento | Técnico atribuído |
| Resolvido | Em atendimento | Técnico e motivo de reabertura |

Resolver diretamente da abertura permite registrar uma solução no primeiro contato. Depois de iniciado, o atendimento não volta para Aberto. Sem mudança de status, campos operacionais podem ser atualizados nos chamados não resolvidos. O técnico não pode ser removido de um chamado em atendimento, pendente ou resolvido.

Pendência exige motivo de 5–2.000 caracteres. Resolução exige solução de 5–4.000 e preenche resolved_at no servidor. Reabertura exige motivo de 5–2.000, limpa resolved_at e a solução atual; as informações anteriores permanecem no histórico. Ao sair de Pendente, o motivo atual é limpo e preservado no histórico.

Chamado resolvido fica bloqueado para edição operacional até reabertura. A reabertura pode incluir correções de campos no mesmo PATCH. Não há exclusão de chamados.

## Histórico

Criação, alterações de título/descrição/prioridade/categoria/responsável/status e os motivos geram eventos. Várias alterações em uma operação produzem um evento agrupado, com valores anteriores e novos. Eventos específicos identificam resolução e reabertura. Atualizações sem mudança não geram eventos artificiais.

Ator: “Operador de demonstração”, identidade não autenticada. Responsável técnico é quem atende o chamado e não é automaticamente seu autor. A timeline dá rastreabilidade funcional; não é uma trilha de auditoria com identidade comprovada ou proteção contra administradores do banco.

## Fora do escopo

SLA, notificações, autenticação, anexos, comentários livres e cadastro administrativo de técnicos. Não há alegação de conformidade formal com ITIL.
