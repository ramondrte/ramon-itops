import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  api,
  useCatalog,
  priorityLabels,
  type Detail,
} from "../services/tickets";
import { ErrorNotice } from "../components/tickets/TicketUI";
export function TicketCreatePage() {
  const catalog = useCatalog(),
    navigate = useNavigate();
  const [type, setType] = useState("incident");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const result = await api<Detail>("/tickets", {
        method: "POST",
        body: JSON.stringify({
          ...fields,
          technician_id: fields.technician_id || null,
        }),
      });
      navigate(`/tickets/${result.id}`, { state: { created: true } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/tickets">
        ← Voltar à fila
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">NOVO ATENDIMENTO</p>
          <h1>Abrir chamado</h1>
          <p>Registre o contexto para uma triagem objetiva.</p>
        </div>
      </section>
      <div className="form-layout">
        <form className="panel ticket-form" onSubmit={submit}>
          {catalog.error && (
            <ErrorNotice message={catalog.error} retry={catalog.retry} />
          )}
          {error && <ErrorNotice message={error} />}
          <fieldset disabled={busy || catalog.loading || !!catalog.error}>
            <legend>Informações do chamado</legend>
            <label>
              Tipo
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="incident">Incidente</option>
                <option value="request">Solicitação</option>
              </select>
              <small>
                {type === "incident"
                  ? "Interrupção ou degradação de um serviço."
                  : "Pedido padrão, como acesso ou instalação de software."}
              </small>
            </label>
            <label>
              Título
              <input
                name="title"
                required
                minLength={5}
                maxLength={160}
                placeholder="Ex.: Estação de demonstração sem acesso à rede"
              />
            </label>
            <label>
              Descrição
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={10000}
                rows={6}
                placeholder="Descreva o ocorrido, o impacto e as verificações já realizadas."
              />
            </label>
            <div className="form-grid">
              <label>
                Solicitante
                <input
                  name="requester"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Nome fictício do solicitante"
                />
              </label>
              <label>
                Categoria
                <select name="category_id" required defaultValue="">
                  <option value="" disabled>
                    Selecione uma categoria
                  </option>
                  {catalog.categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridade
                <select name="priority" defaultValue="medium">
                  {Object.entries(priorityLabels).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Técnico responsável
                <select name="technician_id" defaultValue="">
                  <option value="">Não atribuído</option>
                  {catalog.technicians.map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-actions">
              <Link to="/tickets">Cancelar</Link>
              <button className="primary-button" disabled={busy}>
                {busy ? "Registrando…" : "Registrar chamado"}
              </button>
            </div>
          </fieldset>
        </form>
        <aside className="context-panel">
          <h2>Um registro útil para o suporte</h2>
          <p>
            Informe o serviço afetado, o comportamento observado e o impacto
            operacional.
          </p>
          <h3>Como priorizar</h3>
          <ul>
            <li>
              <b>Baixa:</b> impacto limitado, sem urgência.
            </li>
            <li>
              <b>Média:</b> atendimento necessário, com alternativa disponível.
            </li>
            <li>
              <b>Alta:</b> impacto relevante e necessidade de atuação rápida.
            </li>
            <li>
              <b>Crítica:</b> serviço essencial interrompido, impacto amplo e
              sem alternativa.
            </li>
          </ul>
          <p>
            O chamado será aberto com histórico inicial. A prioridade não define
            SLA nesta fase.
          </p>
          <p className="demo-note">
            Use apenas dados fictícios. Não inclua senhas ou informações
            pessoais reais.
          </p>
        </aside>
      </div>
    </>
  );
}
