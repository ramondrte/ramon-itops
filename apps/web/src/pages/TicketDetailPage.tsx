import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  api,
  useCatalog,
  date,
  priorityLabels,
  statusLabels,
  typeLabels,
  ApiError,
  type Detail,
  type Status,
} from "../services/tickets";
import {
  ErrorNotice,
  PriorityBadge,
  StatusBadge,
} from "../components/tickets/TicketUI";
import { TicketTimeline } from "../components/tickets/TicketTimeline";
export function TicketDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [ticket, setTicket] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<Detail>(`/tickets/${id}`)
      .then((t) => {
        if (active) setTicket(t);
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
  }, [id, attempt]);
  const from =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/tickets?")
      ? location.state.from
      : "/tickets";
  return (
    <>
      <Link className="back-link" to={from}>
        ← Voltar à fila
      </Link>
      {loading ? (
        <p role="status" className="empty-state">
          Carregando chamado…
        </p>
      ) : error ? (
        <ErrorNotice message={error} retry={() => setAttempt((a) => a + 1)} />
      ) : (
        ticket && (
          <>
            <section className="page-heading detail-heading">
              <div>
                <p className="eyebrow">
                  {ticket.number} · {typeLabels[ticket.type]}
                </p>
                <h1>{ticket.title}</h1>
                <div className="badge-row">
                  <StatusBadge value={ticket.status} />
                  <PriorityBadge value={ticket.priority} />
                </div>
              </div>
            </section>
            <div className="detail-grid">
              <div>
                <section className="panel description-panel">
                  <h2>Contexto do chamado</h2>
                  <p className="description">{ticket.description}</p>
                  <dl className="ticket-metadata">
                    <div>
                      <dt>Solicitante</dt>
                      <dd>{ticket.requester}</dd>
                    </div>
                    <div>
                      <dt>Categoria</dt>
                      <dd>{ticket.category_name}</dd>
                    </div>
                    <div>
                      <dt>Responsável</dt>
                      <dd>{ticket.technician_name ?? "Não atribuído"}</dd>
                    </div>
                    <div>
                      <dt>Aberto em</dt>
                      <dd>{date(ticket.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Atualizado em</dt>
                      <dd>{date(ticket.updated_at)}</dd>
                    </div>
                    <div>
                      <dt>Resolvido em</dt>
                      <dd>{date(ticket.resolved_at)}</dd>
                    </div>
                  </dl>
                  {ticket.pending_reason && (
                    <div className="context-note">
                      <b>Pendência</b>
                      <p>{ticket.pending_reason}</p>
                    </div>
                  )}
                  {ticket.resolution_summary && (
                    <div className="context-note">
                      <b>Solução registrada</b>
                      <p>{ticket.resolution_summary}</p>
                    </div>
                  )}
                </section>
                <TicketTimeline events={ticket.history} />
              </div>
              <TicketEditor
                key={`${ticket.id}-${ticket.version}`}
                ticket={ticket}
                saved={setTicket}
                reload={() => setAttempt((a) => a + 1)}
              />
            </div>
          </>
        )
      )}
    </>
  );
}
function TicketEditor({
  ticket,
  saved,
  reload,
}: {
  ticket: Detail;
  saved: (t: Detail) => void;
  reload: () => void;
}) {
  const catalog = useCatalog();
  const [status, setStatus] = useState<Status>(ticket.status);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const locked = ticket.status === "resolved" && !reopening;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const changes: Record<string, unknown> = { version: ticket.version };
    for (const key of [
      "title",
      "description",
      "priority",
      "category_id",
      "technician_id",
      "status",
    ] as const) {
      const value = key === "technician_id" ? values[key] || null : values[key];
      if (value !== ticket[key]) changes[key] = value;
    }
    if (status === "pending" && values.pending_reason !== ticket.pending_reason)
      changes.pending_reason = values.pending_reason;
    if (status === "resolved")
      changes.resolution_summary = values.resolution_summary;
    if (reopening) changes.reopen_reason = values.reopen_reason;
    if (Object.keys(changes).length === 1) {
      setNotice("Nenhuma alteração para salvar.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    setConflict(false);
    try {
      saved(
        await api<Detail>(`/tickets/${ticket.id}`, {
          method: "PATCH",
          body: JSON.stringify(changes),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
      setConflict(e instanceof ApiError && e.status === 409);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel editor-panel">
      <p className="eyebrow">CONDUZIR ATENDIMENTO</p>
      <h2>{locked ? "Atendimento resolvido" : "Atualizar chamado"}</h2>
      {locked ? (
        <>
          <p className="muted">
            A solução está registrada. Reabra caso seja necessário retomar o
            atendimento.
          </p>
          <button
            className="primary-button"
            onClick={() => {
              setReopening(true);
              setStatus("in_progress");
            }}
          >
            Reabrir chamado
          </button>
        </>
      ) : (
        <form className="ticket-form" onSubmit={submit}>
          {catalog.error && (
            <ErrorNotice message={catalog.error} retry={catalog.retry} />
          )}{" "}
          {error && <ErrorNotice message={error} />}{" "}
          {conflict && (
            <button type="button" onClick={reload}>
              Carregar versão atual
            </button>
          )}
          {notice && <p role="status">{notice}</p>}
          <fieldset disabled={busy || catalog.loading || !!catalog.error}>
            <legend className="sr-only">Atualizar atendimento</legend>
            <label>
              Título
              <input
                name="title"
                defaultValue={ticket.title}
                minLength={5}
                maxLength={160}
                required
              />
            </label>
            <label>
              Descrição
              <textarea
                name="description"
                defaultValue={ticket.description}
                rows={4}
                minLength={10}
                maxLength={10000}
                required
              />
            </label>
            <label>
              Responsável
              <select
                key={catalog.technicians.length}
                name="technician_id"
                defaultValue={ticket.technician_id ?? ""}
                required={status !== "open"}
              >
                <option value="">Não atribuído</option>
                {catalog.technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {Object.entries(statusLabels)
                  .filter(([k]) =>
                    reopening
                      ? k === "in_progress"
                      : k !== "open" || ticket.status === "open",
                  )
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Prioridade
                <select name="priority" defaultValue={ticket.priority}>
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
                  key={catalog.categories.length}
                  name="category_id"
                  defaultValue={ticket.category_id}
                  required
                >
                  {catalog.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {status === "pending" && (
              <label>
                Motivo da pendência
                <textarea
                  name="pending_reason"
                  defaultValue={ticket.pending_reason ?? ""}
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
            )}
            {status === "resolved" && (
              <label>
                Resumo da solução
                <textarea
                  name="resolution_summary"
                  required
                  minLength={5}
                  maxLength={4000}
                />
              </label>
            )}
            {reopening && (
              <label>
                Motivo da reabertura
                <textarea
                  name="reopen_reason"
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
            )}
            <button className="primary-button" disabled={busy}>
              {busy
                ? "Salvando…"
                : reopening
                  ? "Confirmar reabertura"
                  : "Salvar atendimento"}
            </button>
            {reopening && (
              <button
                type="button"
                onClick={() => {
                  setReopening(false);
                  setStatus("resolved");
                }}
              >
                Cancelar reabertura
              </button>
            )}
          </fieldset>
        </form>
      )}
      <p className="demo-note">
        Alterações ficam registradas na timeline. Operador de demonstração, sem
        autenticação.
      </p>
    </section>
  );
}
