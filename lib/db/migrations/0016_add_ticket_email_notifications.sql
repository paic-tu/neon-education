CREATE TABLE IF NOT EXISTS ticket_email_notifications (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  claim_id UUID,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  message_id VARCHAR(255),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  last_error VARCHAR(80),
  last_event VARCHAR(80),
  delivery_checked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ticket_email_retry_idx
  ON ticket_email_notifications (next_retry_at) WHERE sent_at IS NULL;
ALTER TABLE payment_email_health
  ADD COLUMN IF NOT EXISTS ticket_email_from TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Do not reuse a provider key with changed content after an uncertain legacy send.
UPDATE payment_email_notifications
SET first_attempt_at = LEAST(first_attempt_at, NOW() - INTERVAL '24 hours'),
    last_error = 'EMAIL_LEGACY_REVIEW_REQUIRED'
WHERE sent_at IS NULL AND first_attempt_at IS NOT NULL
  AND first_attempt_at < (SELECT ticket_email_from FROM payment_email_health WHERE id = 'global');

-- A shared queue keeps receipt and ticket retries and monitoring independent.
CREATE OR REPLACE VIEW order_email_queue AS
SELECT o.id, o.user_id, o.status, o.paid_at, 'receipt'::text AS message_type,
  n.order_id, n.claimed_at, n.sent_at, n.message_id, n.first_attempt_at,
  n.next_retry_at, n.last_event, n.delivery_checked_at
FROM orders o LEFT JOIN payment_email_notifications n ON n.order_id = o.id
WHERE n.order_id IS NOT NULL OR o.paid_at >= (SELECT recovery_from FROM payment_email_health WHERE id = 'global')
UNION ALL
SELECT o.id, o.user_id, o.status, o.paid_at, 'tickets'::text AS message_type,
  n.order_id, n.claimed_at, n.sent_at, n.message_id, n.first_attempt_at,
  n.next_retry_at, n.last_event, n.delivery_checked_at
FROM orders o LEFT JOIN ticket_email_notifications n ON n.order_id = o.id
WHERE o.paid_at >= (SELECT ticket_email_from FROM payment_email_health WHERE id = 'global')
  AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.is_event_ticket);
