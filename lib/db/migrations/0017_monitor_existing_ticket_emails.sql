-- Explicitly queued historical tickets need the same retry and delivery monitoring.
-- This does not enqueue any historical orders.
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
WHERE (n.order_id IS NOT NULL OR o.paid_at >= (SELECT ticket_email_from FROM payment_email_health WHERE id = 'global'))
  AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.is_event_ticket);
