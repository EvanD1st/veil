CREATE TABLE `payment_reports` (
	`auction_id` text PRIMARY KEY NOT NULL,
	`output_key` text NOT NULL,
	`signed_report` text NOT NULL,
	`observed_at` integer NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_output_once` ON `payment_reports` (`output_key`);