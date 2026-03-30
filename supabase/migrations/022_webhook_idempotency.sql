-- Webhook idempotency: persistent dedup replacing in-memory Set
CREATE TABLE IF NOT EXISTS webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-cleanup: delete events older than 7 days to prevent unbounded growth
-- (Stripe retries are within 72h, 7d gives ample margin)
CREATE INDEX idx_webhook_events_processed_at ON webhook_events (processed_at);
