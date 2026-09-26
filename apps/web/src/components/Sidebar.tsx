import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { api } from "../services/tickets";
function Icon({ kind }: { kind: "overview" | "tickets" | "metrics" | "docs" }) {
  const paths = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    tickets: "M4 5h16v14H4z M8 9h8 M8 13h5",
    metrics: "M4 3v17h17 M8 16v-5 M13 16V7 M18 16V4",
    docs: "M5 3h10l4 4v14H5z M14 3v5h5 M9 12h6 M9 16h6",
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
export function Sidebar() {
  const location = useLocation();
  const [health, setHealth] = useState({
    api: "Verificando",
    database: "Verificando",
  });
  useEffect(() => {
    let active = true,
      inFlight = false;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      const [a, b] = await Promise.allSettled([
        api<{ status: string }>("/health"),
        api<{ status: string }>("/health/ready"),
      ]);
      if (active)
        setHealth({
          api:
            a.status === "fulfilled" && a.value.status === "ok"
              ? "Online"
              : "Indisponível",
          database:
            b.status === "fulfilled" && b.value.status === "ready"
              ? "Online"
              : "Indisponível",
        });
      inFlight = false;
    }
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (location.hash !== "#sla-indicadores") return;
    // Aguarda a consulta do dashboard e usa apenas a âncora de navegação.
    const target = () => document.getElementById("sla-indicadores");
    if (target()) {
      target()?.scrollIntoView();
      return;
    }
    const observer = new MutationObserver(() => {
      if (target()) {
        target()?.scrollIntoView();
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById("root")!, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [location]);
  const metrics =
    location.pathname === "/" && location.hash === "#sla-indicadores";
  return (
    <aside className="sidebar">
      <Link className="brand" to="/" aria-label="Ramon ITOps — início">
        <span className="brand-icon" aria-hidden="true">
          R
        </span>
        <span>
          Ramon <b>ITOps</b>
        </span>
      </Link>
      <nav aria-label="Navegação principal">
        <Link
          to="/"
          className={location.pathname === "/" && !metrics ? "active" : ""}
          aria-current={
            location.pathname === "/" && !metrics ? "page" : undefined
          }
        >
          <Icon kind="overview" />
          Visão geral
        </Link>
        <Link
          to="/tickets"
          className={location.pathname.startsWith("/tickets") ? "active" : ""}
          aria-current={
            location.pathname.startsWith("/tickets") ? "page" : undefined
          }
        >
          <Icon kind="tickets" />
          Chamados
        </Link>
        <Link
          to={`/${location.pathname === "/" ? location.search : ""}#sla-indicadores`}
          className={metrics ? "active" : ""}
          aria-current={metrics ? "location" : undefined}
        >
          <Icon kind="metrics" />
          SLA e indicadores
        </Link>
        <a
          href="https://github.com/ramondrte/ramon-itops#documentação"
          target="_blank"
          rel="noreferrer"
        >
          <Icon kind="docs" />
          Documentação
          <span className="external-label" aria-label="abre em nova aba">
            ↗
          </span>
        </a>
      </nav>
      <div className="sidebar-health" aria-label="Saúde dos serviços">
        {Object.entries(health).map(([name, status]) => (
          <div key={name}>
            <span>{name === "api" ? "API" : "Database"}</span>
            <span
              className={`service-health ${status === "Online" ? "online" : status === "Indisponível" ? "offline" : "checking"}`}
            >
              <i aria-hidden="true" />
              {status}
            </span>
          </div>
        ))}
        <small>Ambiente de demonstração</small>
      </div>
    </aside>
  );
}
