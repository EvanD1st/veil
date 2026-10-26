import {sql} from 'drizzle-orm';
import { sqliteTable, text, integer, uniqueIndex, primaryKey, check, index } from 'drizzle-orm/sqlite-core';

// Migration 0006 also supplies immutable-listing and atomic report/grant triggers.
export const digitalAssets=sqliteTable('digital_assets',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),kind:text('kind').notNull(),format:text('format').notNull(),mime:text('mime').notNull(),state:text('state').notNull(),bytes:integer('bytes').notNull().default(0),reservedBytes:integer('reserved_bytes').notNull(),sha256:text('sha256'),createdAt:integer('created_at').notNull(),
},t=>[index('digital_assets_owner').on(t.ownerId,t.createdAt),check('digital_asset_kind',sql`${t.kind} IN ('preview','deliverable')`),check('digital_asset_format',sql`${t.format} IN ('png','jpg','stl')`),check('digital_asset_state',sql`${t.state} IN ('uploading','complete')`),check('digital_asset_bytes',sql`${t.bytes} BETWEEN 0 AND 10485760`),check('digital_asset_reserve',sql`${t.reservedBytes} BETWEEN 1 AND 10485760`),check('digital_asset_complete',sql`(${t.state}='uploading' AND ${t.sha256} IS NULL) OR (${t.state}='complete' AND length(${t.sha256})=64 AND ${t.bytes}>0)`)]);
export const digitalDrafts=sqliteTable('digital_drafts',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),previewId:text('preview_id').notNull().references(()=>digitalAssets.id),fileId:text('file_id').notNull().references(()=>digitalAssets.id),category:text('category').notNull(),license:text('license').notNull(),edition:text('edition').notNull(),provenance:text('provenance').notNull(),receiver:text('receiver').notNull(),createdAt:integer('created_at').notNull(),
},t=>[check('digital_category',sql`${t.category} IN ('Digital Art','Digital Items','Digital Collectibles')`),check('digital_license',sql`length(${t.license}) BETWEEN 10 AND 4000`),check('digital_edition',sql`length(${t.edition})<=200`),check('digital_provenance',sql`length(${t.provenance}) BETWEEN 10 AND 1000`)]);
export const auctions = sqliteTable('auctions', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
  digitalDraftId:text('digital_draft_id').references(()=>digitalDrafts.id),
  title: text('title').notNull(), description: text('description').notNull(),
  category: text('category').notNull(), artwork: text('artwork').notNull(), sellerName: text('seller_name').notNull(),
  reserve: text('reserve').notNull(), closesAt: integer('closes_at').notNull(), unlockRound: integer('unlock_round').notNull(),
  publicKey: text('public_key').notNull(), createdAt: integer('created_at').notNull(),
  paymentWindowHours: integer('payment_window_hours'),
  paymentAddress: text('payment_address'), result: text('result'),
  protocolVersion: integer('protocol_version').notNull().default(1), proofContext: text('proof_context'),
},t=>[uniqueIndex('digital_auction_draft').on(t.digitalDraftId).where(sql`${t.digitalDraftId} IS NOT NULL`)]);
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

export const digitalListings=sqliteTable('digital_listings',{
 auctionId:text('auction_id').primaryKey().references(()=>auctions.id),versionId:text('version_id').unique().notNull().references(()=>digitalDrafts.id),previewId:text('preview_id').notNull().references(()=>digitalAssets.id),fileId:text('file_id').notNull().references(()=>digitalAssets.id),category:text('category').notNull(),license:text('license').notNull(),edition:text('edition').notNull(),provenance:text('provenance').notNull(),bytes:integer('bytes').notNull(),mime:text('mime').notNull(),format:text('format').notNull(),privateSha256:text('private_sha256').notNull(),frozenAt:integer('frozen_at').notNull(),
});
export const digitalEntitlements=sqliteTable('digital_entitlements',{
 auctionId:text('auction_id').primaryKey().references(()=>digitalListings.auctionId),winnerId:text('winner_id').notNull(),resultBinding:text('result_binding').notNull(),invoiceId:text('invoice_id').notNull(),outputKey:text('output_key').unique().notNull(),versionId:text('version_id').notNull().references(()=>digitalDrafts.id),fileId:text('file_id').notNull().references(()=>digitalAssets.id),license:text('license').notNull(),state:text('state').notNull(),grantedAt:integer('granted_at').notNull(),suspendedAt:integer('suspended_at'),
},t=>[check('digital_entitlement_state',sql`${t.state} IN ('active','suspended')`)]);
export const digitalEvents=sqliteTable('digital_events',{
 id:integer('id').primaryKey({autoIncrement:true}),auctionId:text('auction_id').notNull().references(()=>auctions.id),event:text('event').notNull(),recordedAt:integer('recorded_at').notNull(),bytes:integer('bytes'),
},t=>[index('digital_events_auction').on(t.auctionId,t.id),check('digital_event_type',sql`${t.event} IN ('access-granted','chain-suspended','download-served','download-incomplete','download-unavailable','operator-reviewed')`)]);
