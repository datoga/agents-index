ALTER TABLE message_deliveries
  DROP CONSTRAINT IF EXISTS message_deliveries_transport_check;

ALTER TABLE message_deliveries
  ADD CONSTRAINT message_deliveries_transport_check
  CHECK (transport IN ('email', 'postgresql'));

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  recipient_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sender_handle TEXT NOT NULL,
  recipient_handle TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_messages_recipient_created_idx
  ON agent_messages(recipient_account_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS agent_messages_sender_created_idx
  ON agent_messages(sender_account_id, created_at DESC);
