import { useEffect, useState } from "react";
import { api, date, type Detail } from "../../services/tickets";
import type { SlaView } from "../../services/sla";
export function SlaBadge({ sla }: { sla: SlaView }) {
  return (
    <span
      className={`sla-badge sla-${sla.paused ? "paused" : sla.state}`}
      title={sla.label}
    >
      {sla.label}
    </span>
  );
}
export function Coverage({ sla }: { sla: SlaView }) {
  return (
    <span className={`coverage-note coverage-${sla.coverage}`}>
      {sla.coverage === "partial"
        ? `SLA acompanhado desde ${date(sla.tracking_started_at ?? null)} — cobertura parcial`
        : sla.coverage_label}
    </span>
  );
}
export function TicketSla({ ticket }: { ticket: Detail }) {
  const [snapshot, setSnapshot] = useState({
    sla: ticket.sla,
    cycles: ticket.sla_cycles,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true,
      inFlight = false;
    setSnapshot({ sla: ticket.sla, cycles: ticket.sla_cycles });
    setError("");
    async function refresh() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const response = await api<Detail>(`/tickets/${ticket.id}`);
        if (active) {
          setSnapshot({ sla: response.sla, cycles: response.sla_cycles });
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Não foi possível atualizar o SLA. Abaixo está a última consulta.",
          );
      } finally {
        inFlight = false;
      }
    }
    const timer = setInterval(() => void refresh(), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ticket]);
  async function refresh() {
    setBusy(true);
    try {
      const response = await api<Detail>(`/tickets/${ticket.id}`);
      setSnapshot({ sla: response.sla, cycles: response.sla_cycles });
      setError("");
    } catch {
      setError(
        "Não foi possível atualizar o SLA. Abaixo está a última consulta.",
      );
    } finally {
      setBusy(false);
    }
  }
  const { sla, cycles } = snapshot;
  return (
    <section className="panel sla-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">COMPROMISSO DE RESOLUÇÃO</p>
          <h2>SLA do atendimento</h2>
        </div>
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          {busy ? "Atualizando…" : "Atualizar SLA"}
        </button>
      </div>
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      <SlaBadge sla={sla} />
      <p>
        <Coverage sla={sla} />
      </p>
      {sla.coverage === "partial" && (
        <p className="scope-note">
          Este chamado não entra nos indicadores de cobertura integral. O
          período anterior ao acompanhamento não foi reconstruído.
        </p>
      )}
      {sla.coverage !== "none" && (
        <>
          <dl className="ticket-metadata">
            <div>
              <dt>Orçamento do ciclo {sla.cycle_number}</dt>
              <dd>{sla.budget_label} · 24×7</dd>
            </div>
            <div>
              <dt>Tempo consumido</dt>
              <dd>
                {sla.consumed_label} · {sla.consumed_percent?.toFixed(1)}%
              </dd>
            </div>
            <div>
              <dt>
                {sla.ended_at
                  ? "Saldo no encerramento"
                  : sla.paused
                    ? "Saldo congelado"
                    : "Saldo atual"}
              </dt>
              <dd>{sla.balance_label}</dd>
            </div>
            <div>
              <dt>Prazo de resolução</dt>
              <dd>
                {sla.paused
                  ? "A definir na retomada"
                  : date(sla.sla_due_at ?? null)}
              </dd>
            </div>
            {sla.paused && (
              <>
                <div>
                  <dt>Pausa iniciada em</dt>
                  <dd>{date(sla.paused_at ?? null)}</dd>
                </div>
                <div>
                  <dt>Já violado ao entrar em pausa?</dt>
                  <dd>{sla.breached_before_pause ? "Sim" : "Não"}</dd>
                </div>
              </>
            )}
          </dl>
          {!!sla.previous_breached_cycles && (
            <p className="scope-note">
              {sla.previous_breached_cycles} ciclo(s) anterior(es) violado(s). A
              reabertura não apaga esses resultados.
            </p>
          )}
          <details className="sla-cycles">
            <summary>Ciclos e períodos de pausa ({cycles.length})</summary>
            {cycles.map((c) => (
              <article key={c.cycle_id}>
                <strong>
                  Ciclo {c.cycle_number} · {c.label}
                </strong>
                <p>
                  {date(c.started_at ?? null)} →{" "}
                  {c.ended_at ? date(c.ended_at) : "Em andamento"} · orçamento{" "}
                  {c.budget_label}
                </p>
                <p>
                  Consumo: {c.consumed_label} · Política {c.policy_version}
                </p>
                {c.pauses?.length ? (
                  <ul>
                    {c.pauses.map((p) => (
                      <li key={p.id}>
                        Pausa: {date(p.started_at)} →{" "}
                        {p.ended_at ? date(p.ended_at) : "Em curso"}
                        {p.breached_on_entry ? " · já violado na entrada" : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Sem períodos de pausa.</p>
                )}
              </article>
            ))}
          </details>
        </>
      )}
      <p className="caption">
        Calculado pelo backend em {date(sla.calculated_at)}. Atualização a cada
        60 segundos enquanto esta página estiver visível.
      </p>
    </section>
  );
}
