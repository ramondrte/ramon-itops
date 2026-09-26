CREATE TABLE ticket_sla_cycles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_id uuid NOT NULL REFERENCES tickets(id),
 cycle_number integer NOT NULL CHECK (cycle_number > 0),
 start_reason text NOT NULL CHECK (start_reason IN ('created','migration','reopened')),
 policy_version text NOT NULL DEFAULT 'resolution-24x7-v1',
 started_at timestamptz NOT NULL,
 budget_ms bigint NOT NULL CHECK (budget_ms > 0),
 priority text NOT NULL CHECK (priority IN ('low','medium','high','critical')),
 ended_at timestamptz,
 consumed_ms bigint CHECK (consumed_ms >= 0),
 result text CHECK (result IN ('met','breached')),
 UNIQUE(ticket_id, cycle_number),
 CHECK (ended_at IS NULL OR ended_at >= started_at),
 CHECK ((ended_at IS NULL AND consumed_ms IS NULL AND result IS NULL) OR
        (ended_at IS NOT NULL AND consumed_ms IS NOT NULL AND result IS NOT NULL))
);
CREATE UNIQUE INDEX ticket_sla_one_active_cycle ON ticket_sla_cycles(ticket_id) WHERE ended_at IS NULL;
CREATE TABLE ticket_sla_pauses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cycle_id uuid NOT NULL REFERENCES ticket_sla_cycles(id),
 started_at timestamptz NOT NULL,
 ended_at timestamptz,
 breached_on_entry boolean NOT NULL,
 CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX ticket_sla_one_open_pause ON ticket_sla_pauses(cycle_id) WHERE ended_at IS NULL;
CREATE INDEX ticket_sla_pause_cycle_idx ON ticket_sla_pauses(cycle_id, started_at);
