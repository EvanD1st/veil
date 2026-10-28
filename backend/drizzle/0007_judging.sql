-- No wallet keys, mnemonic, cookies, account balances or payment metadata here.
CREATE TABLE judging_families (
 slug TEXT PRIMARY KEY, preview_id TEXT NOT NULL REFERENCES digital_assets(id),
 file_id TEXT NOT NULL REFERENCES digital_assets(id), registered_at INTEGER NOT NULL
);
CREATE TABLE judging_editions (
 id TEXT PRIMARY KEY, family TEXT NOT NULL REFERENCES judging_families(slug),
 edition INTEGER NOT NULL CHECK(edition BETWEEN 1 AND 5),
 auction_id TEXT NOT NULL UNIQUE, closes_at INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('preparing','open','proving','publishing','failed','verified')),
 reason TEXT, updated_at INTEGER NOT NULL, UNIQUE(family,edition)
);
CREATE UNIQUE INDEX judging_one_current_family ON judging_editions(family)
 WHERE state<>'verified';
CREATE TABLE judging_worker_lease (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), edition_id TEXT,
 token_hash TEXT, expires_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO judging_worker_lease(singleton) VALUES(1);
CREATE TABLE judging_edition_requests (
 account_id TEXT NOT NULL, family TEXT NOT NULL, requested_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,family)
);
CREATE TABLE judging_wallet_requests (
 account_id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('blocked','queued','provisioning','backup-required','ready','unavailable')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
-- Only nonfinancial provisioning requests. A request is not a wallet or a grant.
CREATE TRIGGER judging_edition_binding BEFORE UPDATE ON judging_editions
 WHEN NEW.id<>OLD.id OR NEW.family<>OLD.family OR NEW.edition<>OLD.edition
 OR NEW.auction_id<>OLD.auction_id OR NEW.closes_at<>OLD.closes_at
 BEGIN SELECT RAISE(ABORT,'Immutable judging edition'); END;
CREATE TRIGGER judging_family_binding BEFORE UPDATE ON judging_families
 BEGIN SELECT RAISE(ABORT,'Frozen collection originals'); END;
