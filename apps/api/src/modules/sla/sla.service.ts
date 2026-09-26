import type { PoolClient } from "@ramon-itops/database";
import type { Ticket } from "../tickets/tickets.types.js";
import {
  calculateSla,
  SLA_BUDGETS,
  type SlaCycle,
  type SlaPause,
} from "./sla.engine.js";
export async function loadSla(client: PoolClient, ids: string[], at: Date) {
  const result = new Map<string, ReturnType<typeof buildCoverage>>();
  if (!ids.length) return result;
  const cycles = (
    await client.query<SlaCycle>(
      "SELECT * FROM ticket_sla_cycles WHERE ticket_id=ANY($1::uuid[]) ORDER BY cycle_number",
      [ids],
    )
  ).rows;
  const pauses = (
    await client.query<SlaPause>(
      "SELECT p.* FROM ticket_sla_pauses p JOIN ticket_sla_cycles c ON c.id=p.cycle_id WHERE c.ticket_id=ANY($1::uuid[]) ORDER BY p.started_at,p.id",
      [ids],
    )
  ).rows;
  for (const id of ids)
    result.set(
      id,
      buildCoverage(
        cycles.filter((c) => c.ticket_id === id),
        pauses,
        at,
      ),
    );
  return result;
}
function buildCoverage(cycles: SlaCycle[], pauses: SlaPause[], at: Date) {
  const first = cycles[0];
  const coverage = first
    ? first.start_reason === "created"
      ? "full"
      : "partial"
    : "none";
  const coverageLabel =
    coverage === "full"
      ? "SLA acompanhado desde a criação"
      : coverage === "partial"
        ? `SLA acompanhado desde ${first.started_at.toISOString()} — cobertura parcial`
        : "Sem SLA registrado";
  const detailed = cycles.map((c) => ({
    ...calculateSla(
      c,
      pauses.filter((p) => p.cycle_id === c.id),
      at,
    ),
    pauses: pauses.filter((p) => p.cycle_id === c.id),
  }));
  return {
    sla: {
      ...(detailed.at(-1) ?? {
        state: "untracked",
        label: "Sem SLA registrado",
        calculated_at: at,
      }),
      coverage,
      coverage_label: coverageLabel,
      tracking_started_at: first?.started_at ?? null,
      eligible_for_full_coverage_metrics: coverage === "full",
      previous_breached_cycles: detailed
        .slice(0, -1)
        .filter((c) => c.result === "breached").length,
    },
    sla_cycles: detailed,
  };
}
export async function openSla(
  client: PoolClient,
  ticket: Ticket,
  at: Date,
  reason: "created" | "reopened",
) {
  await client.query(
    `INSERT INTO ticket_sla_cycles(ticket_id,cycle_number,start_reason,started_at,budget_ms,priority)
 VALUES ($1,(SELECT coalesce(max(cycle_number),0)+1 FROM ticket_sla_cycles WHERE ticket_id=$1),$2,$3,$4,$5)`,
    [ticket.id, reason, at, SLA_BUDGETS[ticket.priority], ticket.priority],
  );
}
export async function updateSla(
  client: PoolClient,
  previous: Ticket,
  next: Ticket,
  at: Date,
) {
  if (previous.status === "resolved") {
    await openSla(client, next, at, "reopened");
    return;
  }
  const cycle = (
    await client.query<SlaCycle>(
      "SELECT * FROM ticket_sla_cycles WHERE ticket_id=$1 AND ended_at IS NULL",
      [next.id],
    )
  ).rows[0];
  if (!cycle) throw new Error("active_sla_cycle_missing");
  if (previous.priority !== next.priority) {
    cycle.priority = next.priority;
    cycle.budget_ms = SLA_BUDGETS[next.priority];
    await client.query(
      "UPDATE ticket_sla_cycles SET priority=$2,budget_ms=$3 WHERE id=$1",
      [cycle.id, cycle.priority, cycle.budget_ms],
    );
  }
  if (previous.status === "pending" && next.status !== "pending")
    await client.query(
      "UPDATE ticket_sla_pauses SET ended_at=$2 WHERE cycle_id=$1 AND ended_at IS NULL",
      [cycle.id, at],
    );
  const pauses = (
    await client.query<SlaPause>(
      "SELECT * FROM ticket_sla_pauses WHERE cycle_id=$1",
      [cycle.id],
    )
  ).rows;
  const calculated = calculateSla(cycle, pauses, at);
  if (previous.status !== "pending" && next.status === "pending")
    await client.query(
      "INSERT INTO ticket_sla_pauses(cycle_id,started_at,breached_on_entry) VALUES ($1,$2,$3)",
      [cycle.id, at, calculated.remaining_ms < 0],
    );
  if (next.status === "resolved")
    await client.query(
      "UPDATE ticket_sla_cycles SET ended_at=$2,consumed_ms=$3,result=$4 WHERE id=$1",
      [
        cycle.id,
        at,
        calculated.consumed_ms,
        calculated.remaining_ms < 0 ? "breached" : "met",
      ],
    );
}
