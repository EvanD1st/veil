ALTER TABLE `auctions` ADD `protocol_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `auctions` ADD `proof_context` text;