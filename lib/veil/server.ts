import { proofPublicSignals } from './zk/protocol';
import { verifyHighestBid } from './zk/verify';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { Auction, AuctionResult, PublicBid, QUICKNET, MAX_PROOF_BIDS, SNARK_FIELD, auctionProofContext, commitmentFor, isSaplingTestnet, roundTimeMs, sha256, snapshotHash, unlockRoundFor, validZatoshis, validateTimelockArmor } from './core';

type AuctionRow = { payment_window_hours:number|null; protocol_version: 1 | 2; proof_context: string | null; id: string; owner_id: string; title: string; description: string; category: string; artwork: string; seller_name: string; reserve: string; closes_at: number; unlock_round: number; public_key: string; created_at: number; payment_address: string | null; result: string | null; bid_count?: number };
type BidRow = { sequence: number; id: string; auction_id: string; bidder_id: string; commitment: string; ciphertext: string; ciphertext_hash: string; accepted_at: number };
export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
function database() { if (!env.DB) throw new ApiError('The auction database is unavailable. Please try again shortly.', 503); return env.DB as D1Database; }
export async function actor(request: Request, write = false) {
  if (write) {
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && new URL(origin).host !== new URL(request.url).host)) throw new ApiError('Cross-site requests are not accepted.', 403);
  }
  const user = await getChatGPTUser();
  if (!user) throw new ApiError('Sign in to use your auction workspace.', 401);
  return user.userId;
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } }); }
export async function handle(callback: () => Promise<Response>) {
  try { return await callback(); } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    return json({ error: 'The request could not be completed. Refresh to check its status before retrying.' }, 500);
  }
}
export async function body(request: Request, max = 18000): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError('JSON request required.', 415);
  const reader = request.body?.getReader(); if (!reader) throw new ApiError('Request body is missing.');
  let size = 0; const parts: Uint8Array[] = [];
  while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > max) { await reader.cancel(); throw new ApiError('Request is too large.', 413); } parts.push(next.value); }
  const data = new Uint8Array(size); let offset = 0; for (const part of parts) { data.set(part, offset); offset += part.length; }
  try { const value = JSON.parse(new TextDecoder().decode(data)); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw new ApiError('Invalid JSON.'); }
}
function text(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new ApiError(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
function uuid(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) throw new ApiError('Invalid record identifier.'); return value; }
function hex(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new ApiError('Invalid commitment.'); return value; }
function publicBid(row: BidRow): PublicBid { return { id: row.id, sequence: row.sequence, commitment: row.commitment, ciphertextHash: row.ciphertext_hash, acceptedAt: row.accepted_at }; }
export async function auctionRow(id: string) { const row = await database().prepare('SELECT a.*, (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) AS bid_count FROM auctions a WHERE a.id=?').bind(uuid(id)).first<AuctionRow>(); if (!row) throw new ApiError('Auction not found.', 404); return row; }
function publicAuction(row: AuctionRow, userId: string): Auction {
  return { protocolVersion: row.protocol_version, proofContext: row.proof_context, id: row.id, title: row.title, description: row.description, category: row.category, artwork: row.artwork, sellerName: row.seller_name, reserve: row.reserve, closesAt: row.closes_at, unlockRound: row.unlock_round, publicKey: JSON.parse(row.public_key), createdAt: row.created_at, paymentAddress: row.payment_address, paymentWindowHours:row.payment_window_hours, bidCount: row.bid_count ?? 0, isOwner: row.owner_id === userId, state: row.result ? 'result' : Date.now() >= row.closes_at ? 'closed' : 'open', result: row.result ? JSON.parse(row.result) : null };
}
export async function listAuctions(userId: string) {
  const rows = await database().prepare('SELECT a.*, (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) AS bid_count FROM auctions a ORDER BY a.created_at DESC LIMIT 100').all<AuctionRow>();
  return rows.results.map(row => publicAuction(row, userId));
}
export async function myAuctionIds(userId: string) {
  const rows = await database().prepare('SELECT auction_id FROM bids WHERE bidder_id=? ORDER BY accepted_at DESC LIMIT 100').bind(userId).all<{ auction_id: string }>();
  return rows.results.map(row => row.auction_id);
}
export async function details(id: string, userId: string) {
  const row = await auctionRow(id);
  const bids = await database().prepare('SELECT * FROM bids WHERE auction_id=? ORDER BY sequence').bind(id).all<BidRow>();
  return { auction: publicAuction(row, userId), bids: bids.results.map(publicBid), myBid: bids.results.find(b => b.bidder_id === userId)?.id ?? null, snapshotHash: await snapshotHash(id, bids.results.map(publicBid)), serverTime: Date.now() };
}
export async function createAuction(input: Record<string, unknown>, userId: string) {
  const id = uuid(input.id), title = text(input.title, 3, 80, 'Title'), description = text(input.description, 15, 1500, 'Description'), sellerName = text(input.sellerName, 2, 40, 'Seller name');
  const category = text(input.category, 2, 30, 'Category'), artwork = text(input.artwork, 2, 30, 'Cover');
  if (!['Design', 'Art', 'Collectibles'].includes(category) || !['sneaker', 'orbit', 'sculpture'].includes(artwork)) throw new ApiError('Choose an available category and cover.');
  if (!validZatoshis(input.reserve)) throw new ApiError('Invalid reserve price.');
  const closesAt = Number(input.closesAt), now = Date.now();
  if (!Number.isSafeInteger(closesAt) || closesAt < now + 60000 || closesAt > now + 30 * 86400000) throw new ApiError('Choose a closing time between one minute and 30 days from now.');
  const key = input.publicKey as JsonWebKey | undefined;
  if (!key || key.kty !== 'RSA' || key.e !== 'AQAB' || typeof key.n !== 'string' || key.n.length !== 342 || key.d || key.p || key.q || (key.key_ops && key.key_ops.join(',') !== 'encrypt')) throw new ApiError('A fresh public encryption key is required. Never upload the private key.');
  try { await crypto.subtle.importKey('jwk', key, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']); } catch { throw new ApiError('The public encryption key is invalid.'); }
  const publicKey = { kty: key.kty, n: key.n, e: key.e, alg: 'RSA-OAEP-256', key_ops: ['encrypt'], ext: true };
  const address = input.paymentAddress ? text(input.paymentAddress, 20, 200, 'Payment address') : null;
  if (address && !isSaplingTestnet(address)) throw new ApiError('Use a checksum-valid Sapling testnet address beginning ztestsapling1.');
  const count = await database().prepare('SELECT COUNT(*) AS total FROM auctions WHERE owner_id=?').bind(userId).first<{ total: number }>();
  if ((count?.total ?? 0) >= 100) throw new ApiError('This review workspace has reached its 100-auction limit.');
  const paymentWindow=input.paymentWindowHours===undefined?24:input.paymentWindowHours;
  if(paymentWindow!==null&&![24,48,72].includes(paymentWindow as number))throw new ApiError('Choose a payment follow-up window of 24, 48 or 72 hours, or none.');
  const round = unlockRoundFor(closesAt);
  const proofContext = await auctionProofContext({id,reserve:input.reserve,closesAt,unlockRound:round,publicKey,paymentAddress:address});
  await database().prepare('INSERT INTO auctions (id,owner_id,title,description,category,artwork,seller_name,reserve,closes_at,unlock_round,public_key,created_at,payment_address,protocol_version,proof_context,payment_window_hours) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, userId, title, description, category, artwork, sellerName, input.reserve, closesAt, round, JSON.stringify(publicKey), now, address, 2, proofContext,paymentWindow).run();
  return publicAuction(await auctionRow(id), userId);
}
export async function acceptBid(id: string, input: Record<string, unknown>, userId: string) {
  const row = await auctionRow(id), bidId = uuid(input.id), commitment = hex(input.commitment);
  if (row.owner_id === userId) throw new ApiError('Sellers cannot bid on their own auction. Use the guided demo to try both roles.', 403);
  if (Date.now() >= row.closes_at || row.result) throw new ApiError('Bidding has closed.', 409);
  const limit = row.protocol_version === 2 ? MAX_PROOF_BIDS : 32;
  if (row.protocol_version === 2 && BigInt('0x'+commitment)>=SNARK_FIELD) throw new ApiError('Invalid proof-compatible commitment.');
  if ((row.bid_count ?? 0) >= limit) throw new ApiError(`This auction has reached its ${limit}-bid limit.`, 409);
  text(input.ciphertext, 250, 14000, 'Sealed envelope');
  const ciphertext = input.ciphertext as string;
  try { validateTimelockArmor(ciphertext, row.unlock_round); } catch (error) { throw new ApiError((error as Error).message); }
  const ciphertextHash = await sha256(ciphertext), acceptedAt = Date.now();
  try {
    const result = await database().prepare('INSERT INTO bids (id,auction_id,bidder_id,commitment,ciphertext,ciphertext_hash,accepted_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM auctions WHERE id=? AND closes_at>? AND result IS NULL) AND (SELECT COUNT(*) FROM bids WHERE auction_id=?)<?').bind(bidId, id, userId, commitment, ciphertext, ciphertextHash, acceptedAt, id, acceptedAt, id, limit).run();
    if (!result.meta.changes) throw new ApiError('Bidding closed before the bid was accepted.', 409);
  } catch (error) { if (error instanceof ApiError) throw error; if (String(error).includes('UNIQUE')) throw new ApiError('You already have a sealed bid in this auction. Each participant gets one final bid.', 409); throw error; }
  const bid = await database().prepare('SELECT * FROM bids WHERE id=?').bind(bidId).first<BidRow>();
  return { ...publicBid(bid!), auctionId: id, unlockRound: row.unlock_round, chainHash: QUICKNET.hash };
}
export async function sellerEnvelopes(id: string, userId: string) {
  const row = await auctionRow(id);
  if (row.owner_id !== userId) throw new ApiError('Only this auction’s seller can open the envelopes.', 403);
  if (Date.now() < roundTimeMs(row.unlock_round)) throw new ApiError('The auction is still sealed. Wait for the unlock time.', 409);
  const rows = await database().prepare('SELECT * FROM bids WHERE auction_id=? ORDER BY sequence').bind(id).all<BidRow>();
  return rows.results.map(b => ({ ...publicBid(b), ciphertext: b.ciphertext }));
}
export async function declareResult(id: string, input: Record<string, unknown>, userId: string) {
  const row = await auctionRow(id);
  if (row.owner_id !== userId) throw new ApiError('Only the seller can declare the result.', 403);
  if (Date.now() < roundTimeMs(row.unlock_round)) throw new ApiError('Bids have not unlocked yet.', 409);
  if (row.result) throw new ApiError('This auction already has a final declaration.', 409);
  const rows = await database().prepare('SELECT * FROM bids WHERE auction_id=? ORDER BY sequence').bind(id).all<BidRow>();
  const logHash = await snapshotHash(id, rows.results.map(publicBid));
  if (input.snapshotHash !== logHash || input.openedCount !== rows.results.length) throw new ApiError('The result must reference every accepted bid. Refresh and tally again.', 409);
  let winnerId: string | null = null, amount: string | null = null, salt: string | null = null;
  if (input.winnerId) {
    winnerId = uuid(input.winnerId); salt = hex(input.salt);
    if (!validZatoshis(input.amount) || BigInt(input.amount) < BigInt(row.reserve)) throw new ApiError('The winning amount must meet the reserve.');
    amount = input.amount;
    const winner = rows.results.find(b => b.id === winnerId);
    if (!winner || await commitmentFor({ version: row.protocol_version, context: row.proof_context ?? undefined, auctionId: id, bidId: winnerId, amount, salt }) !== winner.commitment) throw new ApiError('The winning bid does not match its accepted commitment.');
  }
  let proof;
  if(row.protocol_version===2){try { proof=await verifyHighestBid(input.proof,proofPublicSignals(publicAuction(row,userId),rows.results.map(publicBid),winnerId,amount)); }catch(error){throw new ApiError((error as Error).message);} }
  const result: AuctionResult = { winnerId, amount, salt, snapshotHash: logHash, declaredAt: Date.now(), status: proof ? 'zk-verified' : 'seller-declared', ...(proof ? {proof} : {}) };
  const update = await database().prepare('UPDATE auctions SET result=? WHERE id=? AND result IS NULL').bind(JSON.stringify(result), id).run();
  if (!update.meta.changes) throw new ApiError('Another result was already declared.', 409);
  return result;
}

// Reports reveal payment metadata only to the seller and winning bidder.
async function paymentAccess(id:string,userId:string){
 const row=await auctionRow(id),auction=publicAuction(row,userId);
 if(!auction.result?.winnerId||!auction.paymentAddress)throw new ApiError('This auction has no payment request.',409);
 const winner=await database().prepare('SELECT bidder_id FROM bids WHERE id=? AND auction_id=?').bind(auction.result.winnerId,id).first<{bidder_id:string}>();
 if(row.owner_id!==userId&&winner?.bidder_id!==userId)throw new ApiError('Payment details are available only to the seller and winner.',403);
 return auction;
}
function scannerKey(){return (env as unknown as Record<string,unknown>).VEIL_SCANNER_PUBLIC_KEY as string|undefined;}
export async function paymentStatus(id:string,userId:string){
 const {paymentInvoice,validatePaymentReport}=await import('./payment');
 const auction=await paymentAccess(id,userId),invoice=await paymentInvoice(auction),key=scannerKey();
 const configured=typeof key==='string'&&/^[a-f0-9]{64}$/.test(key);
 const row=await database().prepare('SELECT signed_report FROM payment_reports WHERE auction_id=?').bind(id).first<{signed_report:string}>();
 const workflow=await paymentWorkflow(auction,userId);
 if(!row)return {configured,invoice,status:'unverified',report:null,workflow};
 const signed=JSON.parse(row.signed_report);
 let status='needs-refresh';
 try{await validatePaymentReport(signed,invoice,key??'');status=signed.report.status==='confirmed'?'scanner-confirmed':'not-confirmed';}catch{/* Expiry, key rotation, or unavailable scanner never stays confirmed. */}
 return {configured,invoice,status,report:signed.report,workflow};
}
export async function submitPaymentReport(id:string,input:Record<string,unknown>,userId:string){
 const {paymentInvoice,validatePaymentReport}=await import('./payment');
 const auction=await paymentAccess(id,userId),invoice=await paymentInvoice(auction);
 let signed;try{signed=await validatePaymentReport(input,invoice,scannerKey()??'');}catch(error){throw new ApiError((error as Error).message);}
 const r=signed.report,outputKey=`testnet:${r.txid}:sapling:${r.output}`;
 try{
  const update=await database().prepare('INSERT INTO payment_reports (auction_id,output_key,signed_report,observed_at) VALUES (?,?,?,?) ON CONFLICT(auction_id) DO UPDATE SET signed_report=excluded.signed_report,observed_at=excluded.observed_at WHERE payment_reports.output_key=excluded.output_key AND payment_reports.observed_at<excluded.observed_at').bind(id,outputKey,JSON.stringify(signed),r.observedAt).run();
  if(!update.meta.changes)throw new ApiError('A newer report is required for the same payment output.',409);
 }catch(error){if(error instanceof ApiError)throw error;if(String(error).includes('UNIQUE'))throw new ApiError('That payment output already belongs to another invoice.',409);throw error;}
 return paymentStatus(id,userId);
}

async function paymentWorkflow(auction:Auction,userId:string){
 const dueAt=auction.paymentWindowHours&&auction.result?auction.result.declaredAt+auction.paymentWindowHours*3600000:null;
 const records=await database().prepare('SELECT action,recorded_at,actor_id FROM payment_followups WHERE auction_id=? ORDER BY recorded_at').bind(auction.id).all<{action:string;recorded_at:number;actor_id:string}>();
 return {dueAt,overdue:dueAt!==null&&Date.now()>=dueAt,isOwner:auction.isOwner,actions:records.results.map(r=>({action:r.action,recordedAt:r.recorded_at,byYou:r.actor_id===userId}))};
}
export async function submitPaymentFollowup(id:string,input:Record<string,unknown>,userId:string){
 const auction=await paymentAccess(id,userId),workflow=await paymentWorkflow(auction,userId);
 if(input.action==='reported-sent'){
  if(auction.isOwner)throw new ApiError('Only the winner can report sending payment.',403);
 }else if(input.action==='requested-discussion'){
  if(workflow.dueAt!==null&&!workflow.overdue)throw new ApiError('The payment follow-up deadline has not arrived.',409);
 }else throw new ApiError('Choose an available payment follow-up action.');
 await database().prepare('INSERT INTO payment_followups (auction_id,actor_id,action,recorded_at) VALUES (?,?,?,?) ON CONFLICT(auction_id,actor_id) DO UPDATE SET action=excluded.action,recorded_at=excluded.recorded_at').bind(id,userId,input.action,Date.now()).run();
 return paymentStatus(id,userId);
}
