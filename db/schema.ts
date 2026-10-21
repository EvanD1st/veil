import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const auctions = sqliteTable('auctions', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
  title: text('title').notNull(), description: text('description').notNull(),
  category: text('category').notNull(), artwork: text('artwork').notNull(), sellerName: text('seller_name').notNull(),
  reserve: text('reserve').notNull(), closesAt: integer('closes_at').notNull(), unlockRound: integer('unlock_round').notNull(),
  publicKey: text('public_key').notNull(), createdAt: integer('created_at').notNull(),
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
