CREATE TABLE `auctions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`artwork` text NOT NULL,
	`seller_name` text NOT NULL,
	`reserve` text NOT NULL,
	`closes_at` integer NOT NULL,
	`unlock_round` integer NOT NULL,
	`public_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`payment_address` text,
	`result` text
);
--> statement-breakpoint
CREATE TABLE `bids` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`auction_id` text NOT NULL,
	`bidder_id` text NOT NULL,
	`commitment` text NOT NULL,
	`ciphertext` text NOT NULL,
	`ciphertext_hash` text NOT NULL,
	`accepted_at` integer NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bid_unique_id` ON `bids` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_bid_per_participant` ON `bids` (`auction_id`,`bidder_id`);