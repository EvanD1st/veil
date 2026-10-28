-- Every signed-in judge may publish an auction for private-bid and result testing.
-- Practice listings deliberately have no payment receiver or protected download.
ALTER TABLE auctions ADD COLUMN auction_kind TEXT NOT NULL DEFAULT 'legacy'
 CHECK(auction_kind IN ('legacy','practice','digital-download'));
UPDATE auctions SET auction_kind='digital-download' WHERE digital_draft_id IS NOT NULL;

CREATE TRIGGER practice_auction_no_payment BEFORE INSERT ON auctions
 WHEN NEW.auction_kind='practice' AND (NEW.payment_address IS NOT NULL OR NEW.digital_draft_id IS NOT NULL OR NEW.payment_mode<>'direct')
 BEGIN SELECT RAISE(ABORT,'Practice auctions cannot request payment or attach protected downloads'); END;
CREATE TRIGGER digital_auction_requires_draft BEFORE INSERT ON auctions
 WHEN NEW.auction_kind='digital-download' AND NEW.digital_draft_id IS NULL
 BEGIN SELECT RAISE(ABORT,'Digital download auctions require a frozen digital draft'); END;
