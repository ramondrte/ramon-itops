CREATE INDEX tickets_resolved_at_idx ON tickets(resolved_at) WHERE status='resolved';
CREATE INDEX ticket_sla_closed_cycle_idx ON ticket_sla_cycles(ticket_id, cycle_number DESC) WHERE ended_at IS NOT NULL;
