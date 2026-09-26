import type { Priority } from "../tickets/tickets.types.js";
export const SLA_BUDGETS: Record<Priority, number> = {
  low: 86400000,
  medium: 43200000,
  high: 14400000,
  critical: 3600000,
};
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
export interface SlaCycle {
  id: string;
  ticket_id: string;
  cycle_number: number;
  start_reason: "created" | "migration" | "reopened";
  policy_version: string;
  started_at: Date;
  ended_at: Date | null;
  budget_ms: number | string;
  consumed_ms: number | string | null;
  priority: Priority;
  result: "met" | "breached" | null;
}
export interface SlaPause {
  id: string;
  cycle_id: string;
  started_at: Date;
  ended_at: Date | null;
  breached_on_entry: boolean;
}
export function durationLabel(milliseconds: number) {
  const minutes = Math.ceil(Math.abs(milliseconds) / 60000);
  if (milliseconds === 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60),
    remaining = minutes % 60;
  return `${hours}h${remaining ? String(remaining).padStart(2, "0") : ""}`;
}
export function calculateSla(cycle: SlaCycle, pauses: SlaPause[], at: Date) {
  const end = cycle.ended_at ?? at;
  const pausedMs = pauses.reduce(
    (sum, p) =>
      sum +
      Math.max(
        0,
        Math.min((p.ended_at ?? end).getTime(), end.getTime()) -
          Math.max(p.started_at.getTime(), cycle.started_at.getTime()),
      ),
    0,
  );
  const consumed =
    cycle.consumed_ms === null
      ? Math.max(0, end.getTime() - cycle.started_at.getTime() - pausedMs)
      : Number(cycle.consumed_ms);
  const budget = Number(cycle.budget_ms),
    remaining = budget - consumed;
  const pause = pauses.find((p) => p.ended_at === null);
  const breached = remaining < 0;
  const state = cycle.result
    ? cycle.result === "breached"
      ? "breached"
      : cycle.start_reason === "reopened"
        ? "met_after_reopen"
        : "met"
    : breached
      ? "breached"
      : remaining <= budget * 0.2
        ? "near_due"
        : "in_progress";
  const isPaused = !!pause && !cycle.ended_at;
  const balanceLabel = breached
    ? `violado em ${durationLabel(remaining)}`
    : `${durationLabel(remaining)} restantes`;
  const label = cycle.result
    ? cycle.result === "breached"
      ? "Resolvido fora do SLA"
      : cycle.start_reason === "reopened"
        ? "SLA cumprido após reabertura"
        : "Resolvido dentro do SLA"
    : isPaused
      ? `SLA pausado — ${balanceLabel}`
      : breached
        ? `SLA violado — ${durationLabel(remaining)}`
        : state === "near_due"
          ? "Próximo do vencimento"
          : "Dentro do SLA";
  return {
    cycle_id: cycle.id,
    cycle_number: cycle.cycle_number,
    start_reason: cycle.start_reason,
    policy_version: cycle.policy_version,
    started_at: cycle.started_at,
    ended_at: cycle.ended_at,
    priority: cycle.priority,
    budget_ms: budget,
    consumed_ms: consumed,
    remaining_ms: remaining,
    exceeded_ms: Math.max(0, -remaining),
    paused_ms: pausedMs,
    consumed_percent: (consumed / budget) * 100,
    paused: isPaused,
    paused_at: pause?.started_at ?? null,
    breached_before_pause: pause?.breached_on_entry ?? false,
    state,
    label,
    balance_label: balanceLabel,
    budget_label: durationLabel(budget),
    consumed_label: durationLabel(consumed),
    sla_due_at: isPaused
      ? null
      : new Date(cycle.started_at.getTime() + budget + pausedMs),
    result: cycle.result,
    calculated_at: at,
  };
}
