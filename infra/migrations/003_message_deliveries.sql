CREATE TABLE IF NOT EXISTS message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  recipient_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transport TEXT NOT NULL DEFAULT 'email' CHECK (transport = 'email'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_deliveries_sender_created_idx
  ON message_deliveries(sender_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_deliveries_recipient_created_idx
  ON message_deliveries(recipient_account_id, created_at DESC);
