import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { api, date, priorityLabels, statusLabels } from "../services/tickets";
import type { OverviewMetrics, Distribution } from "../services/sla";
import { ErrorNotice } from "../components/tickets/TicketUI";
export function OverviewPage() {
  const [params, setParams] = useSearchParams();
  const period = params.get("period") ?? "30d";
  const [data, setData] = useState<OverviewMetrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true,
      inFlight = false;
    setData(null);
    setError("");
    setLoading(true);
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await api<OverviewMetrics>(
          `/metrics/overview?period=${encodeURIComponent(period)}`,
        );
        if (active) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [period, attempt]);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">GOVERNANÇA OPERACIONAL</p>
          <h1>Operações de TI</h1>
          <p>Demanda, compromissos de resolução e situação do atendimento.</p>
        </div>
        <div className="dashboard-controls">
          <label>
            Período
            <select
              value={period}
              onChange={(e) => setParams({ period: e.target.value })}
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="all">Período total</option>
            </select>
          </label>
          <button disabled={loading} onClick={() => setAttempt((a) => a + 1)}>
            Atualizar
          </button>
        </div>
      </section>
      {error && (
        <ErrorNotice message={error} retry={() => setAttempt((a) => a + 1)} />
      )}
      {loading ? (
        <p className="empty-state" role="status">
          Consultando indicadores no PostgreSQL…
        </p>
      ) : (
        data && (
          <>
            <p className="dashboard-timestamp">
              {error ? "Última leitura disponível" : "Calculado"} em{" "}
              {date(data.calculated_at)} ·{" "}
              {data.from
                ? `${date(data.from)} até ${date(data.to)}`
                : "Todas as datas até o instante da consulta"}
            </p>
            <section
              aria-label="Demanda e situação atual"
              className="dashboard-cards"
            >
              <Card
                title="Chamados abertos no período"
                value={data.tickets.created_in_period}
                note="Data de criação na janela selecionada"
              />
              <Card
                title="Backlog atual"
                value={data.operations.backlog}
                note="Não resolvidos · todas as datas"
              />
              <Card
                title="Críticos ativos"
                value={data.operations.critical_open}
                note="Não resolvidos · todas as datas"
              />
            </section>
            <div className="dashboard-section-heading">
              <h2>Resoluções do período</h2>
              <span>
                {data.tickets.resolved_in_period} chamado(s) atualmente
                resolvido(s)
              </span>
            </div>
            <section
              aria-label="Desempenho de resolução"
              className="dashboard-cards"
            >
              <Card
                title="SLA cumprido"
                value={
                  data.sla.compliance_rate === null
                    ? "Sem dados"
                    : `${data.sla.compliance_rate.toFixed(1)}%`
                }
                note={`${data.sla.met} de ${data.sla.eligible} · cobertura integral`}
              />
              <Card
                title="SLA violado"
                value={data.sla.breached}
                note="Resolvidos fora do prazo · cobertura integral"
              />
              <Card
                title="Tempo médio total"
                value={minutes(
                  data.operations.average_total_resolution_minutes,
                )}
                note={`${data.operations.total_resolution_sample} chamado(s) · criação até última resolução`}
              />
            </section>
            <section className="panel coverage-summary">
              <div>
                <p className="eyebrow">COMPARABILIDADE</p>
                <h2>Tempo médio efetivo</h2>
                <strong>
                  {minutes(
                    data.operations.average_effective_resolution_minutes,
                  )}
                </strong>
                <p>
                  {data.operations.effective_resolution_sample} chamado(s) com
                  cobertura integral. Exclui pendências e intervalos em que o
                  chamado esteve resolvido; não representa horas trabalhadas.
                </p>
              </div>
              <div>
                <h3>Cobertura dos indicadores de SLA</h3>
                <p>
                  {data.sla.excluded_partial} resolução(ões) com cobertura
                  parcial e {data.sla.excluded_untracked} sem SLA foram
                  excluídas do percentual principal e da média efetiva.
                </p>
                <p>
                  Resultados parciais, apresentados separadamente:{" "}
                  {data.sla.partial_results.met} cumprido(s) e{" "}
                  {data.sla.partial_results.breached} violado(s).
                </p>
              </div>
            </section>
            <section className="charts-grid">
              <Chart
                title="Prioridade atual dos chamados criados no período"
                entries={Object.entries(priorityLabels).map(
                  ([name, label]) => ({
                    name: label,
                    count:
                      data.distributions.priority.find((d) => d.name === name)
                        ?.count ?? 0,
                  }),
                )}
              />
              <Chart
                title="Status atual dos chamados criados no período"
                entries={Object.entries(statusLabels).map(([name, label]) => ({
                  name: label,
                  count:
                    data.distributions.status.find((d) => d.name === name)
                      ?.count ?? 0,
                }))}
              />
              <Chart
                title="Categoria atual dos chamados criados no período"
                entries={data.distributions.category}
                wide
              />
            </section>
            <p className="scope-note">
              Os gráficos agrupam chamados criados no período pelo estado atual.
              Não são snapshots históricos. Backlog e críticos representam a
              situação atual em todas as datas. Sem comparação histórica, estes
              dados não demonstram tendência ou crescimento por si só.
            </p>
          </>
        )
      )}
      <HealthSummary />
      <p className="demo-note">
        SLA 24×7 com política interna de demonstração. Sem alegação de padrão
        oficial de ITIL.
      </p>
    </>
  );
}
function minutes(value: number | null) {
  return value === null
    ? "Sem dados"
    : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
}
function Card({
  title,
  value,
  note,
}: {
  title: string;
  value: string | number;
  note: string;
}) {
  return (
    <article className="metric dashboard-card">
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
function Chart({
  title,
  entries,
  wide = false,
}: {
  title: string;
  entries: Distribution[];
  wide?: boolean;
}) {
  const max = Math.max(1, ...entries.map((e) => e.count));
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  return (
    <section className={`panel distribution-chart ${wide ? "wide" : ""}`}>
      <h2>{title}</h2>
      <p className="caption">{total} chamado(s) · contagens reais</p>
      {total === 0 ? (
        <p className="empty-state">Sem chamados criados neste período.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.name}>
              <div>
                <span>{entry.name}</span>
                <strong>{entry.count}</strong>
              </div>
              <div className="chart-track" aria-hidden="true">
                <div style={{ width: `${(entry.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function HealthSummary() {
  const [health, setHealth] = useState({
    api: "Verificando",
    database: "Verificando",
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api<{ status: string }>("/health"),
      api<{ status: string }>("/health/ready"),
    ]).then(([a, b]) => {
      if (active)
        setHealth({
          api:
            a.status === "fulfilled" && a.value.status === "ok"
              ? "Disponível"
              : "Indisponível",
          database:
            b.status === "fulfilled" && b.value.status === "ready"
              ? "Disponível"
              : "Indisponível",
        });
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <section className="panel dashboard-health">
      <h2>Saúde do ambiente</h2>
      <span>
        API: <b>{health.api}</b>
      </span>
      <span>
        PostgreSQL: <b>{health.database}</b>
      </span>
      <button onClick={() => setAttempt((a) => a + 1)}>
        Verificar serviços
      </button>
    </section>
  );
}
