import { loadSla, openSla, updateSla } from "../sla/sla.service.js";
import { systemClock, type Clock } from "../sla/sla.engine.js";
import type { PoolClient } from "@ramon-itops/database";
import { TicketsRepository } from "./tickets.repository.js";
import {
  TicketError,
  type TicketInput,
  type TicketPatch,
  type Ticket,
} from "./tickets.types.js";
function normalize<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  ) as T;
}
function requireText(
  value: string | null | undefined,
  min: number,
  field: string,
) {
  if (!value || value.length < min)
    throw new TicketError(
      422,
      "business_rule",
      `${field}: informe pelo menos ${min} caracteres.`,
    );
}
export class TicketsService {
  constructor(
    public repository: TicketsRepository,
    public clock: Clock = systemClock,
  ) {}
  private async decorate(ticket: Ticket, client: PoolClient, at: Date) {
    return {
      ...ticket,
      history: await this.repository.history(ticket.id, client),
      ...(await loadSla(client, [ticket.id], at)).get(ticket.id)!,
    };
  }
  private async validateReferences(
    category: string,
    technician: string | null | undefined,
    client: PoolClient,
  ) {
    if (
      !(await client.query("SELECT id FROM categories WHERE id=$1", [category]))
        .rowCount
    )
      throw new TicketError(
        422,
        "invalid_category",
        "Categoria não encontrada.",
      );
    if (
      technician &&
      !(
        await client.query(
          "SELECT id FROM technicians WHERE id=$1 AND active=true",
          [technician],
        )
      ).rowCount
    )
      throw new TicketError(
        422,
        "invalid_technician",
        "Técnico não encontrado ou inativo.",
      );
  }
  async detail(id: string) {
    return this.repository.db.transaction(async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const ticket = await this.repository.get(id, client);
      if (!ticket)
        throw new TicketError(404, "not_found", "Chamado não encontrado.");
      return this.decorate(ticket, client, this.clock());
    });
  }
  async create(raw: TicketInput) {
    const input = normalize(raw);
    requireText(input.title, 5, "Título");
    requireText(input.description, 10, "Descrição");
    requireText(input.requester, 2, "Solicitante");
    return this.repository.db.transaction(async (client) => {
      await this.validateReferences(
        input.category_id,
        input.technician_id,
        client,
      );
      const at = this.clock();
      const ticket = await this.repository.insert(input, client, at);
      await openSla(client, ticket, at, "created");
      await this.repository.record(
        ticket.id,
        "created",
        Object.fromEntries(
          Object.entries({
            title: ticket.title,
            type: ticket.type,
            priority: ticket.priority,
            status: ticket.status,
            category: ticket.category_name,
            technician: ticket.technician_name,
            requester: ticket.requester,
          }).map(([key, value]) => [key, { from: null, to: value }]),
        ),
        null,
        client,
        at,
      );
      return this.decorate(ticket, client, at);
    });
  }
  async update(id: string, raw: TicketPatch) {
    const patch = normalize(raw);
    return this.repository.db.transaction(async (client) => {
      await client.query("SELECT id FROM tickets WHERE id=$1 FOR UPDATE", [id]);
      const previous = await this.repository.get(id, client);
      if (!previous)
        throw new TicketError(404, "not_found", "Chamado não encontrado.");
      if (previous.version !== patch.version)
        throw new TicketError(
          409,
          "version_conflict",
          "Este chamado foi alterado. Recarregue os dados antes de salvar.",
        );
      const at = this.clock();
      const beforeSla = (await loadSla(client, [id], at)).get(id)!;
      const { version: _version, reopen_reason, ...fields } = patch;
      void _version;
      const next: Ticket = { ...previous, ...fields };
      requireText(next.title, 5, "Título");
      requireText(next.description, 10, "Descrição");
      const reopening =
        previous.status === "resolved" && next.status === "in_progress";
      if (previous.status === "resolved" && !reopening)
        throw new TicketError(
          422,
          "reopen_required",
          "Reabra o chamado antes de alterar o atendimento.",
        );
      if (reopening) requireText(reopen_reason, 5, "Motivo da reabertura");
      else if (reopen_reason !== undefined)
        throw new TicketError(
          422,
          "invalid_reopen",
          "Motivo de reabertura só é permitido ao reabrir.",
        );
      if (previous.status !== "open" && next.status === "open")
        throw new TicketError(
          422,
          "invalid_transition",
          "Um atendimento iniciado não retorna para Aberto.",
        );
      if (next.status !== "open" && !next.technician_id)
        throw new TicketError(
          422,
          "technician_required",
          "Atribua um técnico para continuar.",
        );
      if (patch.pending_reason !== undefined && next.status !== "pending")
        throw new TicketError(
          422,
          "invalid_pending",
          "Motivo de pendência exige status Pendente.",
        );
      if (patch.resolution_summary !== undefined && next.status !== "resolved")
        throw new TicketError(
          422,
          "invalid_resolution",
          "Resumo de solução exige status Resolvido.",
        );
      if (next.status === "pending")
        requireText(next.pending_reason, 5, "Motivo da pendência");
      else next.pending_reason = null;
      if (next.status === "resolved") {
        requireText(next.resolution_summary, 5, "Resumo da solução");
        next.resolved_at = at;
      } else {
        next.resolved_at = null;
        next.resolution_summary = null;
      }
      await this.validateReferences(
        next.category_id,
        next.technician_id,
        client,
      );
      const keys = [
        "title",
        "description",
        "priority",
        "status",
        "category_id",
        "technician_id",
        "pending_reason",
        "resolution_summary",
      ] as const;
      if (!keys.some((key) => previous[key] !== next[key]))
        return this.decorate(previous, client, at);
      const saved = await this.repository.save(next, client, at);
      await updateSla(client, previous, saved, at);
      const afterSla = (await loadSla(client, [id], at)).get(id)!;
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of keys) {
        if (previous[key] === saved[key]) continue;
        const displayKey =
          key === "category_id"
            ? "category_name"
            : key === "technician_id"
              ? "technician_name"
              : key;
        changes[displayKey] = {
          from: previous[displayKey],
          to: saved[displayKey],
        };
      }
      if (
        previous.priority !== saved.priority ||
        previous.status !== saved.status
      ) {
        changes.sla = { from: beforeSla.sla.label, to: afterSla.sla.label };
        changes.sla_budget = {
          from:
            "budget_label" in beforeSla.sla ? beforeSla.sla.budget_label : null,
          to: "budget_label" in afterSla.sla ? afterSla.sla.budget_label : null,
        };
        changes.sla_balance = {
          from:
            "balance_label" in beforeSla.sla
              ? beforeSla.sla.balance_label
              : null,
          to:
            "balance_label" in afterSla.sla ? afterSla.sla.balance_label : null,
        };
      }
      const action = reopening
        ? "reopened"
        : saved.status === "resolved"
          ? "resolved"
          : "updated";
      await this.repository.record(
        id,
        action,
        changes,
        reopen_reason ?? null,
        client,
        at,
      );
      return this.decorate(saved, client, at);
    });
  }
}
