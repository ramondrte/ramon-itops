import { useEffect, useState } from "react";
type Status = "checking" | "up" | "down";
const labels: Record<Status, string> = {
  checking: "Verificando",
  up: "Disponível",
  down: "Indisponível",
};
export function OverviewPage() {
  const [api, setApi] = useState<Status>("checking");
  const [database, setDatabase] = useState<Status>("checking");
  const [checkedAt, setCheckedAt] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    const [live, ready] = await Promise.allSettled([
      fetch("/api/health", {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      }).then(async (r) => r.ok && (await r.json()).status === "ok"),
      fetch("/api/health/ready", {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      }).then(async (r) => r.ok && (await r.json()).checks?.database === "up"),
    ]);
    setApi(live.status === "fulfilled" && live.value ? "up" : "down");
    setDatabase(ready.status === "fulfilled" && ready.value ? "up" : "down");
    setCheckedAt(new Date().toLocaleTimeString("pt-BR"));
    setBusy(false);
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <>
      <section className="intro">
        <p className="eyebrow">VISIBILIDADE PARA OPERAR MELHOR</p>
        <h1>
          O serviço começa
          <br />
          com uma base confiável.
        </h1>
        <p>
          Disponibilidade, atendimento e governança no mesmo lugar.
          <br />
          Acompanhe a base operacional do Ramon ITOps.
        </p>
      </section>
      <section className="health panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">MONITORAMENTO</p>
            <h2>Saúde do ambiente</h2>
          </div>
          <button onClick={() => void refresh()} disabled={busy}>
            {busy ? "Verificando…" : "↻ Atualizar status"}
          </button>
        </div>
        <div className="health-grid" aria-live="polite">
          <StatusCard
            title="API de operações"
            detail="Resposta do serviço"
            status={api}
          />
          <StatusCard
            title="Banco de dados"
            detail="Prontidão verificada pela API"
            status={database}
          />
        </div>
        <p className="caption">
          {checkedAt
            ? `Última verificação às ${checkedAt}. Atualização manual.`
            : "Consultando os serviços…"}{" "}
          O estado do banco depende da resposta da API.
        </p>
      </section>
      <section className="metrics">
        <Metric title="Chamados" subtitle="Volume de atendimento" />
        <Metric title="SLA cumprido" subtitle="Qualidade do serviço" />
        <Metric title="Tempo de resolução" subtitle="Eficiência operacional" />
        <Metric title="Backlog" subtitle="Pendências de atendimento" />
      </section>
      <section id="roadmap" className="panel roadmap">
        <div>
          <p className="eyebrow">CONSTRUÇÃO INCREMENTAL</p>
          <h2>Da infraestrutura à governança</h2>
          <p>Uma evolução guiada por necessidades reais de suporte.</p>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Fundação operacional</strong>
              <p>Ambiente, conectividade e diagnóstico.</p>
            </div>
            <b>BASE ENTREGUE</b>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Service Desk</strong>
              <p>Chamados, responsáveis e histórico de atendimento.</p>
            </div>
            <b>FASE ATUAL</b>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>SLA e governança</strong>
              <p>Prazos, backlog, criticidade e indicadores reais.</p>
            </div>
          </li>
        </ol>
      </section>
    </>
  );
}
function StatusCard({
  title,
  detail,
  status,
}: {
  title: string;
  detail: string;
  status: Status;
}) {
  return (
    <div className="status-card">
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <span className={`status ${status}`}>
        <i />
        {labels[status]}
      </span>
    </div>
  );
}
function Metric({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <article className="metric">
      <h3>{title}</h3>
      <strong>—</strong>
      <p>{subtitle}</p>
      <span>Planejado · sem dados</span>
    </article>
  );
}
