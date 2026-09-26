import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router";
import { OverviewPage } from "./pages/OverviewPage";
import { TicketListPage } from "./pages/TicketListPage";
import { TicketCreatePage } from "./pages/TicketCreatePage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
export function App() {
  return (
    <BrowserRouter useTransitions={false}>
      <div className="layout">
        <aside className="sidebar">
          <Link className="brand" to="/">
            <span className="brand-icon">R</span> Ramon <b>ITOps</b>
          </Link>
          <p className="eyebrow">WORKSPACE OPERACIONAL</p>
          <nav>
            <NavLink to="/" end>
              ◈ Visão operacional
            </NavLink>
            <NavLink to="/tickets">≡ Fila de chamados</NavLink>
            <a
              href="https://github.com/ramondrte/ramon-itops"
              target="_blank"
              rel="noreferrer"
            >
              ↗ Documentação
            </a>
          </nav>
          <div className="aside-bottom">
            <span className="dot" /> Ambiente de demonstração
            <small>Portfólio · Fase 2</small>
          </div>
        </aside>
        <main>
          <header>
            <span>
              Operações de TI <span className="separator">/</span> Service Desk
            </span>
            <span className="badge">FASE 02 · ATENDIMENTO</span>
          </header>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/tickets" element={<TicketListPage />} />
            <Route path="/tickets/new" element={<TicketCreatePage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route
              path="*"
              element={
                <section className="empty-state">
                  <h1>Página não encontrada</h1>
                  <Link to="/tickets">Voltar à fila</Link>
                </section>
              }
            />
          </Routes>
          <footer>
            Ramon ITOps <span>Service Desk · Ambiente de demonstração</span>
          </footer>
        </main>
      </div>
    </BrowserRouter>
  );
}
