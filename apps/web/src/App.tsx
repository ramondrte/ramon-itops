import { demoMode } from "./services/environment";
import { Sidebar } from "./components/Sidebar";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import { OverviewPage } from "./pages/OverviewPage";
import { TicketListPage } from "./pages/TicketListPage";
import { TicketCreatePage } from "./pages/TicketCreatePage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
export function App() {
  return (
    <BrowserRouter useTransitions={false}>
      <div className="layout">
        <Sidebar />
        <main>
          <header>
            <span>
              Operações de TI <span className="separator">/</span> Service Desk
            </span>
            <span className="badge">DEMONSTRAÇÃO</span>
          </header>
          {demoMode && (
            <aside className="demo-notice" role="note">
              <strong>Ambiente de demonstração.</strong> Não insira dados
              pessoais, corporativos ou confidenciais.
              <span>
                Chamados são compartilhados e temporários, removidos após 48
                horas na próxima limpeza. A primeira conexão pode levar cerca de
                um minuto.
              </span>
            </aside>
          )}
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
