ALTER TABLE accounts ALTER COLUMN email_verified_at DROP NOT NULL;

ALTER TABLE otp_challenges DROP CONSTRAINT IF EXISTS otp_challenges_purpose_check;
ALTER TABLE otp_challenges ADD CONSTRAINT otp_challenges_purpose_check
  CHECK (purpose IN ('agent_register', 'agent_login', 'agent_recover', 'admin_login'));

CREATE TABLE IF NOT EXISTS federated_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  display_name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  endpoint_url TEXT NOT NULL,
  parent_handle TEXT REFERENCES federated_indices(handle) ON DELETE SET NULL,
  profile_handle TEXT UNIQUE REFERENCES profiles(handle) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (endpoint_url ~ '^https://')
);

CREATE INDEX IF NOT EXISTS federated_indices_parent_idx ON federated_indices(parent_handle);
CREATE INDEX IF NOT EXISTS federated_indices_status_idx ON federated_indices(status, handle);
