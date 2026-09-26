import { demoMode } from "../services/environment";
import { SlaBadge, Coverage } from "../components/tickets/TicketSla";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  api,
  useCatalog,
  date,
  priorityLabels,
  statusLabels,
  type TicketList,
} from "../services/tickets";
import {
  ErrorNotice,
  PriorityBadge,
  StatusBadge,
} from "../components/tickets/TicketUI";
export function TicketListPage() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const catalog = useCatalog();
  const [data, setData] = useState<TicketList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<TicketList>(`/tickets?${query}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, attempt]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setAttempt((a) => a + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  function page(value: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(value));
    setParams(next);
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">SERVICE DESK</p>
          <h1>Fila de chamados</h1>
          <p>Organize o atendimento e acompanhe cada demanda.</p>
        </div>
        <Link className="primary-button" to="/tickets/new">
          + Abrir chamado
        </Link>
      </section>
      <section className="panel queue">
        <div className="filters">
          <label>
            Status
            <select
              value={params.get("status") ?? ""}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridade
            <select
              value={params.get("priority") ?? ""}
              onChange={(e) => filter("priority", e.target.value)}
            >
              <option value="">Todas as prioridades</option>
              {Object.entries(priorityLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select
              disabled={catalog.loading || !!catalog.error}
              value={params.get("category_id") ?? ""}
              onChange={(e) => filter("category_id", e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {catalog.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setParams({})}>Limpar filtros</button>
        </div>
        {catalog.error && (
          <ErrorNotice message={catalog.error} retry={catalog.retry} />
        )}
        {loading ? (
          <p className="empty-state" role="status">
            {demoMode
              ? "Serviço iniciando. A primeira conexão pode levar alguns segundos."
              : "Carregando chamados…"}
          </p>
        ) : error ? (
          <ErrorNotice message={error} retry={() => setAttempt((a) => a + 1)} />
        ) : (
          data && (
            <>
              <div className="queue-summary">
                <strong>
                  {data.total} chamado{data.total === 1 ? "" : "s"}
                </strong>
                <span>
                  Mais recentes primeiro · SLA calculado em{" "}
                  {date(data.calculated_at)}
                </span>
              </div>
              {data.items.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Chamado</th>
                        <th>Categoria</th>
                        <th>Prioridade</th>
                        <th>Status</th>
                        <th>SLA</th>
                        <th>Responsável</th>
                        <th>Abertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((ticket) => (
                        <tr key={ticket.id}>
                          <td>
                            <Link
                              className="ticket-link"
                              to={`/tickets/${ticket.id}`}
                              state={{ from: `/tickets?${query}` }}
                            >
                              <span>{ticket.number}</span>
                              <strong>{ticket.title}</strong>
                            </Link>
                          </td>
                          <td>{ticket.category_name}</td>
                          <td>
                            <PriorityBadge value={ticket.priority} />
                          </td>
                          <td>
                            <StatusBadge value={ticket.status} />
                          </td>
                          <td className="sla-cell">
                            <SlaBadge sla={ticket.sla} />
                            <Coverage sla={ticket.sla} />
                          </td>
                          <td>
                            {ticket.technician_name ?? (
                              <span className="muted">Não atribuído</span>
                            )}
                          </td>
                          <td className="date-cell">
                            {date(ticket.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <h2>Nenhum chamado nesta fila</h2>
                  <p>Altere os filtros ou registre uma nova demanda.</p>
                </div>
              )}
              <div className="pagination">
                <span>
                  Página {data.page} de{" "}
                  {Math.max(1, Math.ceil(data.total / data.page_size))}
                </span>
                <div>
                  <button
                    disabled={data.page <= 1}
                    onClick={() => page(data.page - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    disabled={data.page * data.page_size >= data.total}
                    onClick={() => page(data.page + 1)}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </section>
      <p className="demo-note">
        Ambiente de demonstração. Utilize somente dados fictícios.
      </p>
    </>
  );
}
