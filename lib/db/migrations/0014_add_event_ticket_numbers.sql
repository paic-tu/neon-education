LOCK TABLE event_tickets IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE event_tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;
CREATE TABLE IF NOT EXISTS event_ticket_counters (
  product_id UUID PRIMARY KEY REFERENCES products(id),
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

WITH numbered AS (
  SELECT t.id,
    (COALESCE(existing.last_number, 0) + ROW_NUMBER() OVER (
      PARTITION BY t.product_id ORDER BY t.created_at, t.order_item_id, t.ordinal, t.id
    ))::integer AS ticket_number
  FROM event_tickets t
  LEFT JOIN (
    SELECT product_id, MAX(ticket_number) AS last_number FROM event_tickets GROUP BY product_id
  ) existing ON existing.product_id = t.product_id
  WHERE t.ticket_number IS NULL
)
UPDATE event_tickets t SET ticket_number = numbered.ticket_number
FROM numbered WHERE t.id = numbered.id;

INSERT INTO event_ticket_counters (product_id, last_number)
SELECT product_id, MAX(ticket_number) FROM event_tickets GROUP BY product_id
ON CONFLICT (product_id) DO UPDATE
SET last_number = GREATEST(event_ticket_counters.last_number, EXCLUDED.last_number);

ALTER TABLE event_tickets ALTER COLUMN ticket_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS event_tickets_product_number_unique ON event_tickets(product_id, ticket_number);

CREATE OR REPLACE FUNCTION assign_event_ticket_number() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE existing_number INTEGER;
BEGIN
  INSERT INTO event_ticket_counters (product_id) VALUES (NEW.product_id)
    ON CONFLICT (product_id) DO NOTHING;
  PERFORM 1 FROM event_ticket_counters WHERE product_id = NEW.product_id FOR UPDATE;

  -- Repeated issuance must not consume a number, including concurrent requests.
  SELECT ticket_number INTO existing_number FROM event_tickets
    WHERE order_item_id = NEW.order_item_id AND ordinal = NEW.ordinal;
  IF FOUND THEN
    NEW.ticket_number := existing_number;
    RETURN NEW;
  END IF;

  UPDATE event_ticket_counters SET last_number = last_number + 1
    WHERE product_id = NEW.product_id RETURNING last_number INTO NEW.ticket_number;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS assign_event_ticket_number ON event_tickets;
CREATE TRIGGER assign_event_ticket_number BEFORE INSERT ON event_tickets
  FOR EACH ROW EXECUTE FUNCTION assign_event_ticket_number();
