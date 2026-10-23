import {sql} from 'drizzle-orm';
import { sqliteTable, text, integer, uniqueIndex, primaryKey, check, index } from 'drizzle-orm/sqlite-core';

export const auctions = sqliteTable('auctions', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
  title: text('title').notNull(), description: text('description').notNull(),
  category: text('category').notNull(), artwork: text('artwork').notNull(), sellerName: text('seller_name').notNull(),
  reserve: text('reserve').notNull(), closesAt: integer('closes_at').notNull(), unlockRound: integer('unlock_round').notNull(),
  publicKey: text('public_key').notNull(), createdAt: integer('created_at').notNull(),
  paymentWindowHours: integer('payment_window_hours'),
  paymentAddress: text('payment_address'), result: text('result'),
  protocolVersion: integer('protocol_version').notNull().default(1), proofContext: text('proof_context'),
});
export const bids = sqliteTable('bids', {
  sequence: integer('sequence').primaryKey({ autoIncrement: true }),
  id: text('id').notNull(), auctionId: text('auction_id').notNull().references(() => auctions.id),
  bidderId: text('bidder_id').notNull(), commitment: text('commitment').notNull(),
  ciphertext: text('ciphertext').notNull(), ciphertextHash: text('ciphertext_hash').notNull(), acceptedAt: integer('accepted_at').notNull(),
}, table => [uniqueIndex('bid_unique_id').on(table.id), uniqueIndex('one_bid_per_participant').on(table.auctionId, table.bidderId)]);
export const paymentReports = sqliteTable('payment_reports', {
  auctionId: text('auction_id').primaryKey().references(()=>auctions.id),
  outputKey: text('output_key').notNull(), signedReport: text('signed_report').notNull(),
  observedAt: integer('observed_at').notNull(),
},table=>[uniqueIndex('payment_output_once').on(table.outputKey)]);

export const paymentFollowups=sqliteTable('payment_followups',{
 auctionId:text('auction_id').notNull().references(()=>auctions.id),actorId:text('actor_id').notNull(),action:text('action').notNull(),recordedAt:integer('recorded_at').notNull(),
},table=>[primaryKey({columns:[table.auctionId,table.actorId]}),check('payment_followup_action',sql`${table.action} IN ('reported-sent','requested-discussion')`)]);

export const paymentScanJobs=sqliteTable('payment_scan_jobs',{
 id:text('id').primaryKey(),auctionId:text('auction_id').notNull().unique().references(()=>auctions.id),requestedBy:text('requested_by').notNull(),invoiceId:text('invoice_id').notNull(),
 txid:text('txid').notNull(),output:integer('output').notNull(),state:text('state').notNull().default('queued'),createdAt:integer('created_at').notNull(),nextAttemptAt:integer('next_attempt_at').notNull(),checkedAt:integer('checked_at'),failures:integer('failures').notNull().default(0),leaseId:text('lease_id'),leaseUntil:integer('lease_until').notNull().default(0),lastLeaseId:text('last_lease_id'),lastReportHash:text('last_report_hash'),expiresAt:integer('expires_at').notNull(),
},table=>[index('payment_scan_due').on(table.nextAttemptAt,table.leaseUntil),check('payment_scan_output',sql`${table.output} BETWEEN 0 AND 65535`),check('payment_scan_state',sql`${table.state} IN ('queued','scanning','pending','unavailable','stopped')`)]);
export const scannerServiceHealth=sqliteTable('scanner_service_health',{
 id:integer('id').primaryKey(),lastSeen:integer('last_seen').notNull(),
},table=>[check('one_scanner_health',sql`${table.id}=1`)]);
