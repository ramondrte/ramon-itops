export interface PauseView {
  id: string;
  started_at: string;
  ended_at: string | null;
  breached_on_entry: boolean;
}
export interface SlaView {
  state: string;
  label: string;
  calculated_at: string;
  coverage?: "full" | "partial" | "none";
  coverage_label?: string;
  tracking_started_at?: string | null;
  eligible_for_full_coverage_metrics?: boolean;
  previous_breached_cycles?: number;
  cycle_id?: string;
  cycle_number?: number;
  start_reason?: string;
  policy_version?: string;
  priority?: string;
  started_at?: string;
  ended_at?: string | null;
  budget_ms?: number;
  consumed_ms?: number;
  remaining_ms?: number;
  exceeded_ms?: number;
  paused_ms?: number;
  consumed_percent?: number;
  paused?: boolean;
  paused_at?: string | null;
  breached_before_pause?: boolean;
  balance_label?: string;
  budget_label?: string;
  consumed_label?: string;
  sla_due_at?: string | null;
  result?: "met" | "breached" | null;
  pauses?: PauseView[];
}
export interface OverviewMetrics {
  period: "7d" | "30d" | "all";
  from: string | null;
  to: string;
  calculated_at: string;
  distribution_population: string;
  backlog_scope: string;
  tickets: { created_in_period: number; resolved_in_period: number };
  operations: {
    backlog: number;
    critical_open: number;
    average_total_resolution_minutes: number | null;
    total_resolution_sample: number;
    average_effective_resolution_minutes: number | null;
    effective_resolution_sample: number;
  };
  sla: {
    met: number;
    breached: number;
    eligible: number;
    compliance_rate: number | null;
    excluded_partial: number;
    excluded_untracked: number;
    partial_results: { met: number; breached: number };
  };
  distributions: {
    priority: Distribution[];
    status: Distribution[];
    category: Distribution[];
  };
}
export interface Distribution {
  name: string;
  count: number;
}
