-- Additive only. Never drop escrow liabilities during rollback.
ALTER TABLE auctions ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'direct' CHECK(payment_mode IN ('direct','escrow-testnet'));
ALTER TABLE auctions ADD COLUMN fulfillment_terms TEXT;
ALTER TABLE auctions ADD COLUMN escrow_payout_address TEXT;
ALTER TABLE auctions ADD COLUMN escrow_fee_cap TEXT;
CREATE TRIGGER auction_escrow_snapshot BEFORE UPDATE OF payment_mode,fulfillment_terms,escrow_payout_address,escrow_fee_cap,payment_address ON auctions
WHEN OLD.payment_mode='escrow-testnet' OR NEW.payment_mode<>OLD.payment_mode
BEGIN SELECT RAISE(ABORT,'Immutable auction payment snapshot'); END;
CREATE TABLE escrow_orders(
 id TEXT PRIMARY KEY REFERENCES auctions(id), bid_id TEXT NOT NULL UNIQUE REFERENCES bids(id),
 buyer_id TEXT NOT NULL,seller_id TEXT NOT NULL,network TEXT NOT NULL CHECK(network='testnet'),
 amount TEXT NOT NULL,invoice_id TEXT NOT NULL UNIQUE,invoice TEXT NOT NULL,terms TEXT NOT NULL,
 payout_address TEXT NOT NULL,refund_address TEXT,fee_cap TEXT NOT NULL,
 created_at INTEGER NOT NULL,delivery_due_at INTEGER NOT NULL,
 fulfillment TEXT NOT NULL DEFAULT 'awaiting' CHECK(fulfillment IN ('awaiting','seller-declared')),
 dispute TEXT NOT NULL DEFAULT 'none' CHECK(dispute IN ('none','open','reviewed')),
 settlement TEXT NOT NULL DEFAULT 'none' CHECK(settlement IN ('none','release-requested','refund-requested','committed','frozen','confirmed')),
 delivery_details TEXT NOT NULL DEFAULT '',tracking TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 0,last_actor TEXT NOT NULL,last_action TEXT NOT NULL,last_reason TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL
);
CREATE TABLE escrow_deposits(
 order_id TEXT PRIMARY KEY REFERENCES escrow_orders(id),output_key TEXT NOT NULL UNIQUE,
 invoice_id TEXT NOT NULL,amount TEXT NOT NULL,first_observed_at INTEGER NOT NULL,late INTEGER NOT NULL CHECK(late IN (0,1))
);
CREATE TABLE escrow_events(
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES escrow_orders(id),actor_id TEXT NOT NULL,
 action TEXT NOT NULL,reason TEXT NOT NULL,recorded_at INTEGER NOT NULL,revision INTEGER NOT NULL,
 UNIQUE(order_id,revision)
);
CREATE TABLE escrow_intents(
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES escrow_orders(id),kind TEXT NOT NULL CHECK(kind IN ('release','refund')),
 destination TEXT NOT NULL,principal TEXT NOT NULL,max_fee TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','cancelled','preparing','prepared','broadcast-unknown','submitted','confirmed','frozen')),
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,prepared_identity TEXT,txid TEXT,
 CHECK(state NOT IN ('prepared','broadcast-unknown','submitted','confirmed') OR prepared_identity IS NOT NULL)
);
CREATE UNIQUE INDEX escrow_one_active_intent ON escrow_intents(order_id) WHERE state<>'cancelled';
CREATE TABLE escrow_intent_events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,intent_id TEXT NOT NULL REFERENCES escrow_intents(id),state TEXT NOT NULL,recorded_at INTEGER NOT NULL);
CREATE TABLE escrow_exceptions(id TEXT PRIMARY KEY,order_id TEXT REFERENCES escrow_orders(id),category TEXT NOT NULL CHECK(category IN ('late','duplicate','partial','excess','unmatched','uncertain')),recorded_at INTEGER NOT NULL,disposition TEXT NOT NULL DEFAULT 'operator-review');
CREATE TRIGGER escrow_order_immutable BEFORE UPDATE ON escrow_orders
WHEN NEW.id<>OLD.id OR NEW.bid_id<>OLD.bid_id OR NEW.buyer_id<>OLD.buyer_id OR NEW.seller_id<>OLD.seller_id OR NEW.network<>OLD.network OR NEW.amount<>OLD.amount OR NEW.invoice_id<>OLD.invoice_id OR NEW.invoice<>OLD.invoice OR NEW.terms<>OLD.terms OR NEW.payout_address<>OLD.payout_address OR NEW.fee_cap<>OLD.fee_cap OR NEW.created_at<>OLD.created_at OR NEW.delivery_due_at<>OLD.delivery_due_at OR NEW.revision<>OLD.revision+1
BEGIN SELECT RAISE(ABORT,'Immutable escrow binding or invalid revision'); END;
CREATE TRIGGER escrow_destination_frozen BEFORE UPDATE OF refund_address ON escrow_orders
WHEN OLD.refund_address IS NOT NEW.refund_address AND (OLD.settlement<>'none' OR EXISTS(SELECT 1 FROM escrow_intents WHERE order_id=OLD.id))
BEGIN SELECT RAISE(ABORT,'Settlement destination frozen'); END;
CREATE TRIGGER escrow_order_event AFTER INSERT ON escrow_orders BEGIN
 INSERT INTO escrow_events(order_id,actor_id,action,reason,recorded_at,revision) VALUES(NEW.id,NEW.last_actor,NEW.last_action,NEW.last_reason,NEW.updated_at,NEW.revision);
END;
CREATE TRIGGER escrow_order_updated AFTER UPDATE ON escrow_orders BEGIN
 INSERT INTO escrow_events(order_id,actor_id,action,reason,recorded_at,revision) VALUES(NEW.id,NEW.last_actor,NEW.last_action,NEW.last_reason,NEW.updated_at,NEW.revision);
 UPDATE escrow_intents SET state='cancelled',updated_at=NEW.updated_at WHERE order_id=NEW.id AND state='requested' AND NEW.dispute='open';
 INSERT INTO escrow_intents(id,order_id,kind,destination,principal,max_fee,created_at,updated_at)
 SELECT NEW.id||':'||NEW.revision,NEW.id,CASE NEW.settlement WHEN 'release-requested' THEN 'release' ELSE 'refund' END,
 CASE NEW.settlement WHEN 'release-requested' THEN NEW.payout_address ELSE NEW.refund_address END,NEW.amount,NEW.fee_cap,NEW.updated_at,NEW.updated_at
 WHERE NEW.settlement IN ('release-requested','refund-requested') AND OLD.settlement<>NEW.settlement;
END;
CREATE TRIGGER escrow_intent_created AFTER INSERT ON escrow_intents BEGIN INSERT INTO escrow_intent_events(intent_id,state,recorded_at) VALUES(NEW.id,NEW.state,NEW.updated_at); END;
CREATE TRIGGER escrow_intent_updated AFTER UPDATE ON escrow_intents BEGIN INSERT INTO escrow_intent_events(intent_id,state,recorded_at) VALUES(NEW.id,NEW.state,NEW.updated_at); END;
CREATE TRIGGER escrow_no_event_update BEFORE UPDATE ON escrow_events BEGIN SELECT RAISE(ABORT,'Append-only audit'); END;
CREATE TRIGGER escrow_no_event_delete BEFORE DELETE ON escrow_events BEGIN SELECT RAISE(ABORT,'Append-only audit'); END;
CREATE TRIGGER escrow_no_intent_event_update BEFORE UPDATE ON escrow_intent_events BEGIN SELECT RAISE(ABORT,'Append-only audit'); END;
CREATE TRIGGER escrow_no_intent_event_delete BEFORE DELETE ON escrow_intent_events BEGIN SELECT RAISE(ABORT,'Append-only audit'); END;
CREATE TRIGGER escrow_no_deposit_update BEFORE UPDATE ON escrow_deposits BEGIN SELECT RAISE(ABORT,'Permanent deposit claim'); END;
CREATE TRIGGER escrow_no_deposit_delete BEFORE DELETE ON escrow_deposits BEGIN SELECT RAISE(ABORT,'Permanent deposit claim'); END;
-- All deposit claims must refer to the same output in the global direct/scanner registry.
CREATE TRIGGER escrow_claim_registry BEFORE INSERT ON escrow_deposits
WHEN NOT EXISTS(SELECT 1 FROM payment_reports WHERE auction_id=NEW.order_id AND output_key=NEW.output_key)
BEGIN SELECT RAISE(ABORT,'Missing global output claim'); END;
CREATE TRIGGER escrow_keep_global_claim BEFORE DELETE ON payment_reports
WHEN EXISTS(SELECT 1 FROM escrow_deposits WHERE order_id=OLD.auction_id)
BEGIN SELECT RAISE(ABORT,'Unsettled or historical escrow claim must remain'); END;
CREATE TRIGGER escrow_deposit_after_insert AFTER INSERT ON payment_reports
WHEN json_extract(NEW.signed_report,'$.report.status')='confirmed' AND EXISTS(SELECT 1 FROM escrow_orders WHERE id=NEW.auction_id)
BEGIN
 INSERT INTO escrow_deposits(order_id,output_key,invoice_id,amount,first_observed_at,late)
 SELECT o.id,NEW.output_key,o.invoice_id,o.amount,NEW.observed_at,
 CASE WHEN a.payment_window_hours IS NOT NULL AND NEW.observed_at>json_extract(a.result,'$.declaredAt')+a.payment_window_hours*3600000 THEN 1 ELSE 0 END
 FROM escrow_orders o JOIN auctions a ON a.id=o.id WHERE o.id=NEW.auction_id
 ON CONFLICT(order_id) DO NOTHING;
END;

CREATE TRIGGER escrow_deposit_after_update AFTER UPDATE ON payment_reports
WHEN json_extract(NEW.signed_report,'$.report.status')='confirmed' AND EXISTS(SELECT 1 FROM escrow_orders WHERE id=NEW.auction_id)
BEGIN
 INSERT INTO escrow_deposits(order_id,output_key,invoice_id,amount,first_observed_at,late)
 SELECT o.id,NEW.output_key,o.invoice_id,o.amount,NEW.observed_at,
 CASE WHEN a.payment_window_hours IS NOT NULL AND NEW.observed_at>json_extract(a.result,'$.declaredAt')+a.payment_window_hours*3600000 THEN 1 ELSE 0 END
 FROM escrow_orders o JOIN auctions a ON a.id=o.id WHERE o.id=NEW.auction_id
 ON CONFLICT(order_id) DO NOTHING;
END;

CREATE TABLE escrow_observations(sequence INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES escrow_orders(id),output_key TEXT NOT NULL,observed_at INTEGER NOT NULL,signed_report TEXT NOT NULL);
CREATE TRIGGER escrow_observe_insert AFTER INSERT ON payment_reports WHEN EXISTS(SELECT 1 FROM escrow_orders WHERE id=NEW.auction_id) BEGIN INSERT INTO escrow_observations(order_id,output_key,observed_at,signed_report) VALUES(NEW.auction_id,NEW.output_key,NEW.observed_at,NEW.signed_report); END;
CREATE TRIGGER escrow_observe_update AFTER UPDATE ON payment_reports WHEN EXISTS(SELECT 1 FROM escrow_orders WHERE id=NEW.auction_id) BEGIN INSERT INTO escrow_observations(order_id,output_key,observed_at,signed_report) VALUES(NEW.auction_id,NEW.output_key,NEW.observed_at,NEW.signed_report); END;
CREATE TRIGGER escrow_no_observation_update BEFORE UPDATE ON escrow_observations BEGIN SELECT RAISE(ABORT,'Append-only observation'); END;
CREATE TRIGGER escrow_no_observation_delete BEFORE DELETE ON escrow_observations BEGIN SELECT RAISE(ABORT,'Append-only observation'); END;
CREATE TRIGGER escrow_intent_binding BEFORE UPDATE ON escrow_intents WHEN NEW.id<>OLD.id OR NEW.order_id<>OLD.order_id OR NEW.kind<>OLD.kind OR NEW.destination<>OLD.destination OR NEW.principal<>OLD.principal OR NEW.max_fee<>OLD.max_fee OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Immutable settlement intent'); END;
CREATE TRIGGER escrow_no_order_delete BEFORE DELETE ON escrow_orders BEGIN SELECT RAISE(ABORT,'Preserve escrow obligations'); END;
CREATE TRIGGER escrow_late_exception AFTER INSERT ON escrow_deposits WHEN NEW.late=1 BEGIN INSERT INTO escrow_exceptions(id,order_id,category,recorded_at) VALUES(NEW.order_id||':late',NEW.order_id,'late',NEW.first_observed_at); END;
