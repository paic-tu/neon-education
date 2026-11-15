ALTER TABLE payment_email_notifications
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error VARCHAR(80),
  ADD COLUMN IF NOT EXISTS last_event VARCHAR(80),
  ADD COLUMN IF NOT EXISTS delivery_checked_at TIMESTAMPTZ;

-- Legacy failures did not persist whether the provider accepted the message.
UPDATE payment_email_notifications
SET attempt_count = 1, first_attempt_at = NOW() - INTERVAL '24 hours',
    last_error = 'EMAIL_LEGACY_REVIEW_REQUIRED'
WHERE sent_at IS NULL AND attempt_count = 0 AND first_attempt_at IS NULL;

CREATE INDEX IF NOT EXISTS payment_email_retry_idx
  ON payment_email_notifications (next_retry_at) WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS payment_email_health (
  id TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ,
  domain_status VARCHAR(80),
  last_error VARCHAR(80),
  claim_id UUID,
  claimed_at TIMESTAMPTZ
);

ALTER TABLE payment_email_health ADD COLUMN IF NOT EXISTS recovery_from TIMESTAMPTZ NOT NULL DEFAULT NOW();
INSERT INTO payment_email_health (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
