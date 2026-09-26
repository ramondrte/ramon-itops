import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSla,
  SLA_BUDGETS,
  type SlaCycle,
  type SlaPause,
} from "../src/modules/sla/sla.engine.js";
const start = new Date("2026-09-01T00:00:00Z");
const minute = (n: number) => new Date(start.getTime() + n * 60000);
function cycle(priority: keyof typeof SLA_BUDGETS = "high"): SlaCycle {
  return {
    id: "cycle",
    ticket_id: "ticket",
    cycle_number: 1,
    start_reason: "created",
    policy_version: "resolution-24x7-v1",
    started_at: start,
    ended_at: null,
    budget_ms: SLA_BUDGETS[priority],
    consumed_ms: null,
    priority,
    result: null,
  };
}
test("orçamento inicial de todas as prioridades e prazo crítico", () => {
  for (const priority of Object.keys(
    SLA_BUDGETS,
  ) as (keyof typeof SLA_BUDGETS)[]) {
    const value = calculateSla(cycle(priority), [], start);
    assert.equal(value.remaining_ms, SLA_BUDGETS[priority]);
    assert.equal(
      value.sla_due_at?.getTime(),
      start.getTime() + SLA_BUDGETS[priority],
    );
  }
  assert.equal(
    calculateSla(cycle("critical"), [], minute(61)).exceeded_ms,
    60000,
  );
});
test("limites exatos de 20%, zero restante e violação", () => {
  assert.equal(
    calculateSla(cycle("critical"), [], minute(47)).state,
    "in_progress",
  );
  assert.equal(
    calculateSla(cycle("critical"), [], minute(48)).state,
    "near_due",
  );
  assert.equal(
    calculateSla(cycle("critical"), [], minute(60)).state,
    "near_due",
  );
  assert.equal(
    calculateSla(cycle("critical"), [], new Date(minute(60).getTime() + 1))
      .state,
    "breached",
  );
});
test("pausa persiste saldo de 2h30, percentual e ausência de prazo", () => {
  const pause: SlaPause = {
    id: "pause",
    cycle_id: "cycle",
    started_at: minute(90),
    ended_at: null,
    breached_on_entry: false,
  };
  const value = calculateSla(cycle(), [pause], minute(270));
  assert.equal(value.consumed_ms, 90 * 60000);
  assert.equal(value.remaining_ms, 150 * 60000);
  assert.equal(value.consumed_percent, 37.5);
  assert.equal(value.sla_due_at, null);
  assert.equal(value.label, "SLA pausado — 2h30 restantes");
  pause.ended_at = minute(270);
  assert.equal(
    calculateSla(cycle(), [pause], minute(300)).remaining_ms,
    120 * 60000,
  );
  assert.equal(
    calculateSla(cycle(), [pause], minute(300)).sla_due_at?.getTime(),
    minute(420).getTime(),
  );
});
test("pausa após violação mantém atraso e sinal de entrada", () => {
  const value = calculateSla(
    cycle("critical"),
    [
      {
        id: "p",
        cycle_id: "cycle",
        started_at: minute(90),
        ended_at: null,
        breached_on_entry: true,
      },
    ],
    minute(600),
  );
  assert.equal(value.remaining_ms, -30 * 60000);
  assert.equal(value.breached_before_pause, true);
  assert.equal(value.consumed_percent, 150);
  assert.equal(value.label, "SLA pausado — violado em 30 min");
});
test("resultado encerrado permanece congelado e identifica reabertura", () => {
  const closed = {
    ...cycle(),
    ended_at: minute(60),
    consumed_ms: 60 * 60000,
    result: "met" as const,
  };
  assert.equal(calculateSla(closed, [], minute(10000)).state, "met");
  assert.equal(
    calculateSla({ ...closed, start_reason: "reopened" }, [], minute(10000))
      .state,
    "met_after_reopen",
  );
});
