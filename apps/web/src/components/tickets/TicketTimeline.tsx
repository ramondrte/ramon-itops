import {
  date,
  priorityLabels,
  statusLabels,
  typeLabels,
  type HistoryEvent,
} from "../../services/tickets";
const fieldLabels: Record<string, string> = {
  sla: "Situação do SLA",
  sla_budget: "Orçamento do SLA",
  sla_balance: "Saldo do SLA",
  sla_tracking: "Início do acompanhamento SLA",
  title: "Título",
  description: "Descrição",
  priority: "Prioridade",
  status: "Status",
  category: "Categoria",
  category_name: "Categoria",
  technician: "Responsável",
  technician_name: "Responsável",
  requester: "Solicitante",
  type: "Tipo",
  pending_reason: "Motivo da pendência",
  resolution_summary: "Resumo da solução",
};
const actions: Record<string, string> = {
  created: "Chamado registrado",
  updated: "Atendimento atualizado",
  resolved: "Chamado resolvido",
  reopened: "Chamado reaberto",
};
function display(field: string, value: unknown) {
  if (value === null) return "Não definido";
  const dictionary: Record<string, string> =
    field === "priority"
      ? priorityLabels
      : field === "status"
        ? statusLabels
        : field === "type"
          ? typeLabels
          : {};
  return dictionary[String(value)] ?? String(value);
}
export function TicketTimeline({ events }: { events: HistoryEvent[] }) {
  return (
    <section className="panel timeline-panel">
      <p className="eyebrow">RASTREABILIDADE</p>
      <h2>Histórico do atendimento</h2>
      <ol className="timeline">
        {[...events].reverse().map((event) => (
          <li key={event.id}>
            <div className="timeline-heading">
              <strong>{actions[event.action] ?? event.action}</strong>
              <time dateTime={event.created_at}>{date(event.created_at)}</time>
            </div>
            <p className="actor">{event.actor} · identidade não autenticada</p>
            <ul>
              {Object.entries(event.changes).map(([field, change]) => (
                <li key={field}>
                  <b>{fieldLabels[field] ?? field}:</b>{" "}
                  {event.action === "created" ? (
                    display(field, change.to)
                  ) : (
                    <>
                      {display(field, change.from)}{" "}
                      <span aria-label="alterado para">→</span>{" "}
                      {display(field, change.to)}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {event.note && <p className="event-note">Motivo: {event.note}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
