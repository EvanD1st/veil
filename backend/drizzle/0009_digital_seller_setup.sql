-- Seller receiver setup requests contain only a public testnet receiver address.
-- Viewing keys and spending credentials are never accepted by this web service.
CREATE TABLE digital_seller_requests (
 account_id TEXT PRIMARY KEY REFERENCES veil_accounts(id),
 receiver TEXT NOT NULL UNIQUE,
 requested_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX digital_seller_requests_updated ON digital_seller_requests(updated_at,account_id);
