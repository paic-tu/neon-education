ALTER TABLE products ADD COLUMN IF NOT EXISTS event_add_ons JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_add_on_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_add_ons JSONB NOT NULL DEFAULT '[]'::jsonb;
