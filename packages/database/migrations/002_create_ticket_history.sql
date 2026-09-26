CREATE TABLE ticket_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 ticket_id uuid NOT NULL REFERENCES tickets(id),
 action text NOT NULL CHECK (action IN ('created','updated','resolved','reopened')),
 actor text NOT NULL DEFAULT 'Operador de demonstração',
 changes jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'object'),
 note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_history_timeline_idx ON ticket_history(ticket_id, created_at, id);
