CREATE TABLE categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 100)
);
CREATE TABLE technicians (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sequence_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 type text NOT NULL CHECK (type IN ('incident','request')),
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 160),
 description text NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 10000),
 category_id uuid NOT NULL REFERENCES categories(id),
 priority text NOT NULL CHECK (priority IN ('low','medium','high','critical')),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','pending','resolved')),
 requester text NOT NULL CHECK (length(trim(requester)) BETWEEN 2 AND 100),
 technician_id uuid REFERENCES technicians(id),
 pending_reason text,
 resolution_summary text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 CHECK (status = 'open' OR technician_id IS NOT NULL),
 CHECK (status <> 'pending' OR length(trim(pending_reason)) >= 5 AND pending_reason IS NOT NULL),
 CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
 CHECK (status <> 'resolved' OR length(trim(resolution_summary)) >= 5 AND resolution_summary IS NOT NULL)
);
CREATE INDEX tickets_created_idx ON tickets(created_at DESC, id);
CREATE INDEX tickets_status_idx ON tickets(status);
CREATE INDEX tickets_priority_idx ON tickets(priority);
CREATE INDEX tickets_category_idx ON tickets(category_id);
CREATE INDEX tickets_technician_idx ON tickets(technician_id);
