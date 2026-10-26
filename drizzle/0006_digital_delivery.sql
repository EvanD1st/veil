-- Additive digital fulfillment; every pre-existing auction remains legacy (NULL draft).
CREATE TABLE digital_assets (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('preview','deliverable')),
 format TEXT NOT NULL CHECK(format IN ('png','jpg','stl')), mime TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('uploading','complete')), bytes INTEGER NOT NULL DEFAULT 0 CHECK(bytes>=0 AND bytes<=10485760),
 reserved_bytes INTEGER NOT NULL CHECK(reserved_bytes>0 AND reserved_bytes<=10485760),
 sha256 TEXT, created_at INTEGER NOT NULL,
 CHECK((state='uploading' AND sha256 IS NULL) OR (state='complete' AND length(sha256)=64 AND bytes>0))
);
CREATE INDEX digital_assets_owner ON digital_assets(owner_id,created_at);
CREATE TABLE digital_drafts (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, preview_id TEXT NOT NULL REFERENCES digital_assets(id),
 file_id TEXT NOT NULL REFERENCES digital_assets(id), category TEXT NOT NULL CHECK(category IN ('Digital Art','Digital Items','Digital Collectibles')),
 license TEXT NOT NULL CHECK(length(license) BETWEEN 10 AND 4000), edition TEXT NOT NULL CHECK(length(edition)<=200),
 provenance TEXT NOT NULL CHECK(length(provenance) BETWEEN 10 AND 1000), receiver TEXT NOT NULL, created_at INTEGER NOT NULL
);
ALTER TABLE auctions ADD COLUMN digital_draft_id TEXT REFERENCES digital_drafts(id);
CREATE UNIQUE INDEX digital_auction_draft ON auctions(digital_draft_id) WHERE digital_draft_id IS NOT NULL;
CREATE TABLE digital_listings (
 auction_id TEXT PRIMARY KEY REFERENCES auctions(id), version_id TEXT UNIQUE NOT NULL REFERENCES digital_drafts(id),
 preview_id TEXT NOT NULL REFERENCES digital_assets(id), file_id TEXT NOT NULL REFERENCES digital_assets(id),
 category TEXT NOT NULL, license TEXT NOT NULL, edition TEXT NOT NULL, provenance TEXT NOT NULL, bytes INTEGER NOT NULL,
 mime TEXT NOT NULL, format TEXT NOT NULL, private_sha256 TEXT NOT NULL, frozen_at INTEGER NOT NULL
);
CREATE TABLE digital_entitlements (
 auction_id TEXT PRIMARY KEY REFERENCES digital_listings(auction_id), winner_id TEXT NOT NULL,
 result_binding TEXT NOT NULL, invoice_id TEXT NOT NULL, output_key TEXT UNIQUE NOT NULL,
 version_id TEXT NOT NULL REFERENCES digital_drafts(id), file_id TEXT NOT NULL REFERENCES digital_assets(id),
 license TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('active','suspended')),
 granted_at INTEGER NOT NULL, suspended_at INTEGER
);
CREATE TABLE digital_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, auction_id TEXT NOT NULL REFERENCES auctions(id),
 event TEXT NOT NULL CHECK(event IN ('access-granted','chain-suspended','download-served','download-incomplete','download-unavailable','operator-reviewed')),
 recorded_at INTEGER NOT NULL, bytes INTEGER
);
CREATE INDEX digital_events_auction ON digital_events(auction_id,id);
CREATE TRIGGER digital_auction_guard BEFORE INSERT ON auctions WHEN NEW.digital_draft_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM digital_drafts d JOIN digital_assets p ON p.id=d.preview_id JOIN digital_assets f ON f.id=d.file_id
 WHERE d.id=NEW.digital_draft_id AND d.owner_id=NEW.owner_id AND d.category=NEW.category AND d.receiver=NEW.payment_address
 AND NEW.payment_mode='direct' AND NEW.result IS NULL
 AND p.owner_id=NEW.owner_id AND f.owner_id=NEW.owner_id AND p.kind='preview' AND f.kind='deliverable'
 AND p.state='complete' AND f.state='complete'
 ) THEN RAISE(ABORT,'Digital draft unavailable') END;
END;
CREATE TRIGGER digital_freeze AFTER INSERT ON auctions WHEN NEW.digital_draft_id IS NOT NULL BEGIN
 INSERT INTO digital_listings SELECT NEW.id,d.id,d.preview_id,d.file_id,d.category,d.license,d.edition,d.provenance,
 f.bytes,f.mime,f.format,f.sha256,NEW.created_at
 FROM digital_drafts d JOIN digital_assets f ON f.id=d.file_id WHERE d.id=NEW.digital_draft_id;
END;
CREATE TRIGGER digital_listing_no_update BEFORE UPDATE ON digital_listings BEGIN SELECT RAISE(ABORT,'Frozen digital listing'); END;
CREATE TRIGGER digital_auction_no_replace BEFORE UPDATE ON auctions
 WHEN EXISTS(SELECT 1 FROM digital_listings WHERE auction_id=OLD.id)
 AND (NEW.digital_draft_id IS NOT OLD.digital_draft_id OR NEW.category IS NOT OLD.category OR NEW.payment_address IS NOT OLD.payment_address OR NEW.owner_id IS NOT OLD.owner_id OR NEW.title IS NOT OLD.title OR NEW.description IS NOT OLD.description)
 BEGIN SELECT RAISE(ABORT,'Frozen digital auction'); END;
CREATE TRIGGER digital_listing_no_delete BEFORE DELETE ON digital_listings BEGIN SELECT RAISE(ABORT,'Frozen digital listing'); END;
CREATE TRIGGER digital_draft_no_update BEFORE UPDATE ON digital_drafts
 WHEN EXISTS(SELECT 1 FROM digital_listings WHERE version_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Frozen digital draft'); END;
CREATE TRIGGER digital_draft_no_delete BEFORE DELETE ON digital_drafts
 WHEN EXISTS(SELECT 1 FROM digital_listings WHERE version_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Frozen digital draft'); END;
CREATE TRIGGER digital_asset_no_update BEFORE UPDATE ON digital_assets
 WHEN EXISTS(SELECT 1 FROM digital_listings WHERE file_id=OLD.id OR preview_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Frozen digital file'); END;
CREATE TRIGGER digital_asset_no_delete BEFORE DELETE ON digital_assets
 WHEN EXISTS(SELECT 1 FROM digital_listings WHERE file_id=OLD.id OR preview_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Frozen digital file'); END;
-- Only the existing signature/canonical-invoice validated report commit can reach these triggers.
-- Trigger and report changes share one SQLite/D1 transaction, including crash/ACK retries.
CREATE TRIGGER digital_grant_insert AFTER INSERT ON payment_reports BEGIN 
 INSERT INTO digital_events(auction_id,event,recorded_at)
 SELECT NEW.auction_id,'access-granted',NEW.observed_at
 WHERE json_extract(NEW.signed_report,'$.report.status')='confirmed'
 AND EXISTS(SELECT 1 FROM digital_listings l JOIN auctions a ON a.id=l.auction_id
 JOIN bids b ON b.id=json_extract(a.result,'$.winnerId') AND b.auction_id=a.id
 WHERE l.auction_id=NEW.auction_id AND json_extract(a.result,'$.status')='zk-verified'
 AND a.payment_mode='direct' AND json_extract(NEW.signed_report,'$.report.address')=a.payment_address
 AND json_extract(NEW.signed_report,'$.report.amount')=json_extract(a.result,'$.amount'))
 AND NOT EXISTS(SELECT 1 FROM digital_entitlements WHERE auction_id=NEW.auction_id);
 INSERT INTO digital_entitlements(auction_id,winner_id,result_binding,invoice_id,output_key,version_id,file_id,license,state,granted_at)
 SELECT a.id,b.bidder_id,a.result,json_extract(NEW.signed_report,'$.report.invoiceId'),NEW.output_key,l.version_id,l.file_id,l.license,'active',NEW.observed_at
 FROM digital_listings l JOIN auctions a ON a.id=l.auction_id
 JOIN bids b ON b.id=json_extract(a.result,'$.winnerId') AND b.auction_id=a.id
 WHERE l.auction_id=NEW.auction_id AND a.payment_mode='direct'
 AND json_extract(a.result,'$.status')='zk-verified'
 AND json_extract(NEW.signed_report,'$.report.status')='confirmed'
 AND json_extract(NEW.signed_report,'$.report.address')=a.payment_address
 AND json_extract(NEW.signed_report,'$.report.amount')=json_extract(a.result,'$.amount')
 ON CONFLICT(auction_id) DO NOTHING;
 INSERT INTO digital_events(auction_id,event,recorded_at)
 SELECT auction_id,'chain-suspended',NEW.observed_at FROM digital_entitlements
 WHERE auction_id=NEW.auction_id AND output_key=NEW.output_key AND state='active'
 AND json_extract(NEW.signed_report,'$.report.status')='not-confirmed';
 UPDATE digital_entitlements SET state='suspended',suspended_at=NEW.observed_at
 WHERE auction_id=NEW.auction_id AND output_key=NEW.output_key AND state='active'
 AND json_extract(NEW.signed_report,'$.report.status')='not-confirmed';
END;
CREATE TRIGGER digital_grant_update AFTER UPDATE ON payment_reports BEGIN 
 INSERT INTO digital_events(auction_id,event,recorded_at)
 SELECT NEW.auction_id,'access-granted',NEW.observed_at
 WHERE json_extract(NEW.signed_report,'$.report.status')='confirmed'
 AND EXISTS(SELECT 1 FROM digital_listings l JOIN auctions a ON a.id=l.auction_id
 JOIN bids b ON b.id=json_extract(a.result,'$.winnerId') AND b.auction_id=a.id
 WHERE l.auction_id=NEW.auction_id AND json_extract(a.result,'$.status')='zk-verified'
 AND a.payment_mode='direct' AND json_extract(NEW.signed_report,'$.report.address')=a.payment_address
 AND json_extract(NEW.signed_report,'$.report.amount')=json_extract(a.result,'$.amount'))
 AND NOT EXISTS(SELECT 1 FROM digital_entitlements WHERE auction_id=NEW.auction_id);
 INSERT INTO digital_entitlements(auction_id,winner_id,result_binding,invoice_id,output_key,version_id,file_id,license,state,granted_at)
 SELECT a.id,b.bidder_id,a.result,json_extract(NEW.signed_report,'$.report.invoiceId'),NEW.output_key,l.version_id,l.file_id,l.license,'active',NEW.observed_at
 FROM digital_listings l JOIN auctions a ON a.id=l.auction_id
 JOIN bids b ON b.id=json_extract(a.result,'$.winnerId') AND b.auction_id=a.id
 WHERE l.auction_id=NEW.auction_id AND a.payment_mode='direct'
 AND json_extract(a.result,'$.status')='zk-verified'
 AND json_extract(NEW.signed_report,'$.report.status')='confirmed'
 AND json_extract(NEW.signed_report,'$.report.address')=a.payment_address
 AND json_extract(NEW.signed_report,'$.report.amount')=json_extract(a.result,'$.amount')
 ON CONFLICT(auction_id) DO NOTHING;
 INSERT INTO digital_events(auction_id,event,recorded_at)
 SELECT auction_id,'chain-suspended',NEW.observed_at FROM digital_entitlements
 WHERE auction_id=NEW.auction_id AND output_key=NEW.output_key AND state='active'
 AND json_extract(NEW.signed_report,'$.report.status')='not-confirmed';
 UPDATE digital_entitlements SET state='suspended',suspended_at=NEW.observed_at
 WHERE auction_id=NEW.auction_id AND output_key=NEW.output_key AND state='active'
 AND json_extract(NEW.signed_report,'$.report.status')='not-confirmed';
END;
