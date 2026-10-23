ALTER TABLE `auctions` ADD `payment_window_hours` integer;
--> statement-breakpoint
CREATE TABLE `payment_followups` (
 `auction_id` text NOT NULL REFERENCES `auctions`(`id`),
 `actor_id` text NOT NULL,
 `action` text NOT NULL,
 `recorded_at` integer NOT NULL,
 CONSTRAINT `payment_followup_action` CHECK (`action` IN ('reported-sent','requested-discussion')),
 PRIMARY KEY (`auction_id`,`actor_id`)
);
