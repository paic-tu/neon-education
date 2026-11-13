CREATE TABLE IF NOT EXISTS payment_email_notifications (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  claim_id UUID,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  message_id VARCHAR(255)
);
