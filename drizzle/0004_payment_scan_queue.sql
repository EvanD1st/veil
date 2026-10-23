CREATE TABLE payment_scan_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  auction_id TEXT NOT NULL UNIQUE REFERENCES auctions(id),
  requested_by TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  txid TEXT NOT NULL,
  output INTEGER NOT NULL CHECK(output BETWEEN 0 AND 65535),
  state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','scanning','pending','unavailable','stopped')),
  created_at INTEGER NOT NULL,
  next_attempt_at INTEGER NOT NULL,
  checked_at INTEGER,
  failures INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  last_lease_id TEXT,
  last_report_hash TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX payment_scan_due ON payment_scan_jobs(next_attempt_at,lease_until);
CREATE TABLE scanner_service_health (
  id INTEGER PRIMARY KEY CHECK(id=1),
  last_seen INTEGER NOT NULL
);
