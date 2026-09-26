-- Sem retroatividade: o relógio começa no instante desta migration.
-- Executar a implantação com a API parada para não misturar versões.
LOCK TABLE tickets IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO ticket_sla_cycles(ticket_id, cycle_number, start_reason, started_at, budget_ms, priority)
SELECT id, 1, 'migration', date_trunc('milliseconds', CURRENT_TIMESTAMP),
 CASE priority WHEN 'low' THEN 86400000 WHEN 'medium' THEN 43200000 WHEN 'high' THEN 14400000 ELSE 3600000 END,
 priority FROM tickets WHERE status <> 'resolved';
INSERT INTO ticket_sla_pauses(cycle_id, started_at, breached_on_entry)
SELECT c.id, c.started_at, false FROM ticket_sla_cycles c JOIN tickets t ON t.id=c.ticket_id
WHERE c.start_reason='migration' AND t.status='pending';
INSERT INTO ticket_history(ticket_id, action, actor, changes, note, created_at)
SELECT ticket_id, 'updated', 'Sistema — implantação SLA',
 jsonb_build_object('sla_tracking',jsonb_build_object('from',NULL,'to',started_at)),
 'Início de acompanhamento de SLA com cobertura parcial; sem reconstrução retroativa.', started_at
FROM ticket_sla_cycles WHERE start_reason='migration';
