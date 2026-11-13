ALTER TYPE role ADD VALUE IF NOT EXISTS 'event_staff';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(32) NOT NULL DEFAULT 'physical';
ALTER TABLE products ADD COLUMN IF NOT EXISTS event_starts_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS event_ends_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS event_location TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_event_ticket BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS event_staff_assignments (
  product_id UUID NOT NULL REFERENCES products(id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, user_id)
);
CREATE TABLE IF NOT EXISTS event_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  product_id UUID NOT NULL REFERENCES products(id),
  user_id UUID NOT NULL REFERENCES users(id),
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 1 AND 99),
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS event_tickets_item_ordinal_unique ON event_tickets(order_item_id, ordinal);
CREATE INDEX IF NOT EXISTS event_tickets_owner_idx ON event_tickets(user_id);
CREATE INDEX IF NOT EXISTS event_tickets_product_idx ON event_tickets(product_id);
CREATE TABLE IF NOT EXISTS event_scan_limits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_starts_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL
);
CREATE OR REPLACE FUNCTION guard_event_order_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p products%ROWTYPE; o orders%ROWTYPE; reserved BIGINT;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO p FROM products WHERE id = NEW.product_id FOR UPDATE;
  IF p.product_type <> 'event_ticket' THEN RETURN NEW; END IF;
  SELECT * INTO o FROM orders WHERE id = NEW.order_id;
  IF NOT p.is_active OR p.event_ends_at <= NOW() OR p.event_starts_at IS NULL
    OR p.event_ends_at IS NULL OR NEW.quantity NOT BETWEEN 1 AND 99
    OR o.payment_provider NOT IN ('stream', 'coupon') THEN
    RAISE EXCEPTION 'Event ticket order is not allowed';
  END IF;
  SELECT COALESCE(SUM(i.quantity), 0) INTO reserved FROM order_items i
    JOIN orders other_order ON other_order.id = i.order_id
    WHERE i.product_id = p.id AND other_order.status IN ('pending', 'paid', 'shipped', 'delivered');
  IF reserved + NEW.quantity > p.stock_quantity THEN
    RAISE EXCEPTION 'Event ticket capacity exceeded';
  END IF;
  NEW.is_event_ticket := true;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_event_order_item ON order_items;
CREATE TRIGGER guard_event_order_item BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION guard_event_order_item();
