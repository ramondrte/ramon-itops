-- Controles inertes até vinculação explícita de um banco exclusivo de demo.
CREATE TABLE demo_environment (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 environment_id uuid NOT NULL,
 purpose text NOT NULL CHECK (purpose = 'public-demo'),
 last_cleanup_at timestamptz
);
CREATE TABLE demo_tickets (
 ticket_id uuid PRIMARY KEY REFERENCES tickets(id),
 environment_id uuid NOT NULL
);
CREATE TABLE demo_rate_windows (
 bucket_key text NOT NULL,
 window_start timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 attempts integer NOT NULL CHECK (attempts > 0),
 PRIMARY KEY(bucket_key, window_start)
);
CREATE INDEX demo_rate_expiry_idx ON demo_rate_windows(expires_at);
