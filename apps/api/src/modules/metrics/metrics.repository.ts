import type { Database } from "@ramon-itops/database";
export async function overviewMetrics(
  db: Database,
  period: "7d" | "30d" | "all",
  at: Date,
) {
  const from =
    period === "all"
      ? null
      : new Date(at.getTime() - (period === "7d" ? 7 : 30) * 86400000);
  const result = await db.query(
    `WITH
 population AS (SELECT * FROM tickets WHERE created_at <= $2),
 demand AS (SELECT * FROM population WHERE ($1::timestamptz IS NULL OR created_at >= $1)),
 cycle_totals AS (
   SELECT ticket_id, sum(consumed_ms) AS effective_ms,
   (array_agg(start_reason ORDER BY cycle_number))[1]='created' AS full_coverage
   FROM ticket_sla_cycles GROUP BY ticket_id
 ),
 latest AS (SELECT DISTINCT ON (ticket_id) ticket_id,result FROM ticket_sla_cycles ORDER BY ticket_id,cycle_number DESC),
 resolutions AS (
   SELECT t.*,c.full_coverage,c.effective_ms,l.result FROM population t
   LEFT JOIN cycle_totals c ON c.ticket_id=t.id LEFT JOIN latest l ON l.ticket_id=t.id
   WHERE t.status='resolved' AND t.resolved_at <= $2 AND ($1::timestamptz IS NULL OR t.resolved_at >= $1)
 ),
 sla_counts AS (SELECT
   count(*) FILTER(WHERE full_coverage AND result='met') AS met,
   count(*) FILTER(WHERE full_coverage AND result='breached') AS breached,
   count(*) FILTER(WHERE NOT full_coverage AND result IS NOT NULL) AS excluded_partial,
   count(*) FILTER(WHERE result IS NULL) AS excluded_untracked,
   count(*) FILTER(WHERE NOT full_coverage AND result='met') AS partial_met,
   count(*) FILTER(WHERE NOT full_coverage AND result='breached') AS partial_breached
   FROM resolutions)
 SELECT json_build_object(
 'tickets',json_build_object('created_in_period',(SELECT count(*) FROM demand),'resolved_in_period',(SELECT count(*) FROM resolutions)),
 'operations',json_build_object(
   'backlog',(SELECT count(*) FROM population WHERE status<>'resolved'),
   'critical_open',(SELECT count(*) FROM population WHERE status<>'resolved' AND priority='critical'),
   'average_total_resolution_minutes',(SELECT round((avg(extract(epoch FROM resolved_at-created_at))/60)::numeric,2) FROM resolutions),
   'total_resolution_sample',(SELECT count(*) FROM resolutions),
   'average_effective_resolution_minutes',(SELECT round((avg(effective_ms)/60000)::numeric,2) FROM resolutions WHERE full_coverage AND result IS NOT NULL),
   'effective_resolution_sample',(SELECT count(*) FROM resolutions WHERE full_coverage AND result IS NOT NULL)),
 'sla',(SELECT json_build_object('met',met,'breached',breached,'eligible',met+breached,
   'compliance_rate',round(100.0*met/nullif(met+breached,0),2),
   'excluded_partial',excluded_partial,'excluded_untracked',excluded_untracked,
   'partial_results',json_build_object('met',partial_met,'breached',partial_breached)) FROM sla_counts),
 'distributions',json_build_object(
   'priority',coalesce((SELECT json_agg(x ORDER BY x.name) FROM (SELECT priority AS name,count(*) AS count FROM demand GROUP BY priority)x),'[]'::json),
   'status',coalesce((SELECT json_agg(x ORDER BY x.name) FROM (SELECT status AS name,count(*) AS count FROM demand GROUP BY status)x),'[]'::json),
   'category',coalesce((SELECT json_agg(x ORDER BY x.count DESC,x.name) FROM (SELECT c.name,count(*) AS count FROM demand d JOIN categories c ON c.id=d.category_id GROUP BY c.id,c.name)x),'[]'::json))
 ) AS data`,
    [from, at],
  );
  return {
    period,
    from,
    to: at,
    calculated_at: at,
    distribution_population:
      "Chamados criados no período, agrupados pelo estado atual",
    backlog_scope: "Atual — todas as datas",
    ...result.rows[0].data,
  };
}
