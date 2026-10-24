import {env} from 'cloudflare:workers';
import {isSaplingTestnet,validZatoshis} from './core';
import {paymentInvoice,validatePaymentReport} from './payment';
import {ApiError,auctionRow,details,paymentStatus} from './server';
const db=()=>env.DB as D1Database;
const setting=(key:string)=>String((env as unknown as Record<string,unknown>)[key]??'');
export const escrowEnabled=()=>setting('VEIL_EXPERIMENTAL_TESTNET_ESCROW')==='1';
export const settlementsStopped=()=>setting('VEIL_ESCROW_SETTLEMENTS_ENABLED')!=='1';
export function escrowConfiguration(){return {enabled:escrowEnabled(),executorEnabled:false,custody:'operator-custodied',network:'testnet',maxFee:'10000'};}
function str(value:unknown,min:number,max:number,label:string){if(typeof value!=='string'||value.trim().length<min||value.length>max||/[\u0000-\u0008\u000b-\u001f]/.test(value))throw new ApiError('Invalid '+label+'.');return value.trim();}
export function creationPolicy(input:Record<string,unknown>,sellerAddress:string|null){
 if(input.paymentMode===undefined||input.paymentMode==='direct'){if(input.fulfillmentTerms!==undefined)throw new ApiError('Fulfillment terms require escrow.');return {mode:'direct',terms:null,payout:null,address:sellerAddress,fee:null};}
 if(input.paymentMode!=='escrow-testnet'||!escrowEnabled())throw new ApiError('Experimental escrow is disabled.',403);
 if(!sellerAddress||!isSaplingTestnet(sellerAddress))throw new ApiError('A Sapling TESTNET seller payout destination is required.');
 const address=setting('VEIL_ESCROW_DEPOSIT_ADDRESS');if(!isSaplingTestnet(address))throw new ApiError('Custody receiver is unavailable.',503);
 const t=input.fulfillmentTerms as Record<string,unknown>;
 if(!t||Object.keys(t).sort().join(',')!=='deliveryDays,deliveryMethod,eligibleLocations,itemType,shippingTerms')throw new ApiError('Complete all fulfillment terms.');
 if(!['digital','physical','service'].includes(String(t.itemType))||!['digital-download','shipping-included','pickup','service'].includes(String(t.deliveryMethod)))throw new ApiError('Unsupported fulfillment method.');
 if((t.itemType==='physical'&&!['shipping-included','pickup'].includes(String(t.deliveryMethod)))||(t.itemType==='digital'&&t.deliveryMethod!=='digital-download')||(t.itemType==='service'&&t.deliveryMethod!=='service'))throw new ApiError('Delivery method does not match item type.');
 if(!Number.isInteger(t.deliveryDays)||(t.deliveryDays as number)<1||(t.deliveryDays as number)>90)throw new ApiError('Delivery must be 1–90 days.');
 const terms={itemType:t.itemType,deliveryMethod:t.deliveryMethod,deliveryDays:t.deliveryDays,eligibleLocations:str(t.eligibleLocations,2,300,'eligible locations'),shippingTerms:str(t.shippingTerms,5,600,'shipping terms'),fees:'Network fee deducted from winning amount; maximum 10000 zatoshis.',custody:'Experimental TESTNET operator-custodied escrow. No automatic release, refund, delivery or dispute-resolution guarantee.'};
 if(!validZatoshis(input.reserve)||BigInt(input.reserve)<=10000n)throw new ApiError('Escrow reserve must exceed the 10000-zatoshi fee cap.');
 return {mode:'escrow-testnet',terms:JSON.stringify(terms),payout:sellerAddress,address,fee:'10000'};
}
type Order={id:string;bid_id:string;buyer_id:string;seller_id:string;amount:string;invoice_id:string;invoice:string;terms:string;payout_address:string;refund_address:string|null;fee_cap:string;created_at:number;delivery_due_at:number;fulfillment:string;dispute:string;settlement:string;delivery_details:string;tracking:string;revision:number;last_actor:string};
export async function ensureEscrowOrder(id:string){
 const row=await auctionRow(id);if(row.payment_mode!=='escrow-testnet')return null;
 const existing=await db().prepare('SELECT * FROM escrow_orders WHERE id=?').bind(id).first<Order>();if(existing)return existing;
 const auction=(await details(id,row.owner_id)).auction;
 if(!auction.result?.winnerId)return null;if(auction.result.status!=='zk-verified')throw new ApiError('Escrow requires a published verified winning result.',409);
 const invoice=await paymentInvoice(auction),now=Date.now(),terms=JSON.parse(row.fulfillment_terms!);
 const publishedAt=auction.result.declaredAt,deliveryDueAt=publishedAt+terms.deliveryDays*86400000;
 if(!Number.isSafeInteger(publishedAt)||publishedAt<0||!Number.isSafeInteger(deliveryDueAt)||deliveryDueAt<=publishedAt)throw new ApiError('Invalid published delivery deadline.',409);
 await db().prepare(`INSERT INTO escrow_orders(id,bid_id,buyer_id,seller_id,network,amount,invoice_id,invoice,terms,payout_address,fee_cap,created_at,delivery_due_at,last_actor,last_action,updated_at)
 SELECT a.id,b.id,b.bidder_id,a.owner_id,'testnet',?,?,?,?,?,?,?,?,'system','order-created',? FROM auctions a JOIN bids b ON b.auction_id=a.id AND b.id=? WHERE a.id=? AND a.payment_mode='escrow-testnet' AND a.result IS NOT NULL ON CONFLICT(id) DO NOTHING`).bind(invoice.amount,invoice.invoiceId,JSON.stringify(invoice),row.fulfillment_terms,row.escrow_payout_address,row.escrow_fee_cap,now,deliveryDueAt,now,auction.result.winnerId,id).run();
 return db().prepare('SELECT * FROM escrow_orders WHERE id=?').bind(id).first<Order>();
}
function operator(userId:string){return setting('VEIL_ESCROW_OPERATOR_IDS').split(',').map(x=>x.trim()).filter(Boolean).includes(userId);}
async function access(id:string,userId:string){
 // Reject unrelated viewers before lazy creation writes an order or its audit event.
 // A dispute operator can only access an existing order with an authorized dispute.
 await auctionRow(id);
 let order=await db().prepare('SELECT * FROM escrow_orders WHERE id=?').bind(id).first<Order>();
 if(!order){
  const detail=await details(id,userId);
  if(!detail.auction.isOwner&&(!detail.auction.result?.winnerId||detail.myBid!==detail.auction.result.winnerId))throw new ApiError('Private escrow order.',403);
  order=await ensureEscrowOrder(id);
 }
 if(!order)throw new ApiError('No payable escrow order.',409);
 if(userId!==order.buyer_id&&userId!==order.seller_id&&!(operator(userId)&&(order.dispute==='open'||(order.dispute==='reviewed'&&order.last_actor===userId))))throw new ApiError('Private escrow order.',403);
 return order;
}
async function refundDestinationFrozen(order:Order){return order.settlement!=='none'||order.dispute!=='none'||!!await db().prepare('SELECT id FROM escrow_intents WHERE order_id=? LIMIT 1').bind(order.id).first();}
async function funding(order:Order){
 const ledger=await db().prepare('SELECT * FROM escrow_deposits WHERE order_id=?').bind(order.id).first<{output_key:string;late:number}>();
 const report=await db().prepare('SELECT signed_report FROM payment_reports WHERE auction_id=?').bind(order.id).first<{signed_report:string}>();
 let current=false,expiresAt:number|null=null;
 try{if(report){const signed=await validatePaymentReport(JSON.parse(report.signed_report),JSON.parse(order.invoice),setting('VEIL_SCANNER_PUBLIC_KEY'));expiresAt=signed.report.expiresAt;current=signed.report.status==='confirmed'&&ledger?.output_key===`testnet:${signed.report.txid}:sapling:${signed.report.output}`;}}catch{}
 return {state:!ledger?'unverified':current&&!ledger.late?'current':'uncertain',durableDeposit:!!ledger,expiresAt,late:!!ledger?.late};
}
export async function escrowStatus(id:string,userId:string){
 const o=await access(id,userId),funds=await funding(o),events=await db().prepare('SELECT action,reason,recorded_at,actor_id FROM escrow_events WHERE order_id=? ORDER BY sequence').bind(id).all<{action:string;reason:string;recorded_at:number;actor_id:string}>(),intent=await db().prepare("SELECT kind,state,created_at,updated_at FROM escrow_intents WHERE order_id=? AND state<>'cancelled'").bind(id).first();
 return {experimental:true,custody:'operator-custodied',network:'testnet',executorEnabled:false,settlementsStopped:settlementsStopped(),invoice:JSON.parse(o.invoice),terms:JSON.parse(o.terms),funding:funds,fulfillment:o.fulfillment,dispute:o.dispute,settlement:o.settlement,intent,deliveryDueAt:o.delivery_due_at,overdue:Date.now()>o.delivery_due_at,deliveryDetails:o.delivery_details,tracking:o.tracking,payoutAddress:o.payout_address,refundAddress:o.refund_address,refundDestinationFrozen:await refundDestinationFrozen(o),amount:o.amount,maxFee:o.fee_cap,revision:o.revision,role:userId===o.buyer_id?'buyer':userId===o.seller_id?'seller':'operator',events:events.results.map(e=>({action:e.action,reason:e.reason,recordedAt:e.recorded_at,byYou:e.actor_id===userId}))};
}
export async function escrowAction(id:string,input:Record<string,unknown>,userId:string){
 const o=await access(id,userId),action=input.action,now=Date.now();
 if(!Number.isInteger(input.revision)||input.revision!==o.revision)throw new ApiError('Order changed. Refresh before retrying.',409);
 if(['committed','confirmed','frozen'].includes(o.settlement))throw new ApiError('Settlement committed or frozen; operator reconciliation required.',409);
 let values:Record<string,string|null>={},reason='';
 const buyer=userId===o.buyer_id,seller=userId===o.seller_id;
 if(action==='delivery-details'){
  if(!buyer||o.settlement!=='none')throw new ApiError('Buyer delivery details are locked.',403);
  values.delivery_details=str(input.details,1,1500,'private delivery details');
 }else if(action==='refund-destination'){
  if(!buyer||await refundDestinationFrozen(o))throw new ApiError('Refund destination is frozen; existing authorizations require operator review.',403);
  if(typeof input.address!=='string'||!isSaplingTestnet(input.address))throw new ApiError('Use a Sapling TESTNET refund receiver.');values.refund_address=input.address;
 }else if(action==='fulfilled'){
  if(!seller||o.dispute!=='none'||o.fulfillment!=='awaiting')throw new ApiError('Only seller can declare fulfillment before dispute.',403);
  const tracking=typeof input.tracking==='string'?input.tracking.trim():'';
  if(tracking.length>300||/[\u0000-\u001f<>]/.test(tracking))throw new ApiError('Invalid tracking reference.');
  if(tracking.includes('://')){let u;try{u=new URL(tracking);}catch{throw new ApiError('Invalid tracking URL.');}if(u.protocol!=='https:'||u.username||u.password||u.hash)throw new ApiError('Tracking links require clean HTTPS URLs.');}
  values.fulfillment='seller-declared';values.tracking=tracking;
 }else if(action==='dispute'||action==='review-request'){
  if(!buyer&&!(seller&&action==='review-request'))throw new ApiError('Participant review action required.',403);
  if(o.dispute==='open')return escrowStatus(id,userId);
  reason=str(input.reason,5,600,'review reason');values.dispute='open';values.settlement='none';
 }else if(action==='release'||action==='operator-release'||action==='operator-refund'){
  const isOperator=action!=='release';
  if(isOperator){if(!operator(userId)||o.dispute!=='open')throw new ApiError('Separate settlement operator and open dispute required.',403);reason=str(input.reason,10,600,'operator decision reason');values.dispute='reviewed';}
  else if(!buyer||o.dispute!=='none'||o.fulfillment!=='seller-declared'||input.confirm!=='I confirm receipt and authorize payment to the seller')throw new ApiError('Buyer receipt authorization and seller fulfillment required.',403);
  if(o.settlement!=='none')throw new ApiError('Settlement already requested.',409);
  if((await funding(o)).state!=='current')throw new ApiError('Fresh confirmed deposit evidence required; funds frozen pending review.',409);
  if(!o.refund_address)throw new ApiError('Freeze a verified TESTNET refund destination first.',409);
  // Intent only. The disabled executor is the sole future preparation boundary.
  values.settlement=action==='operator-refund'?'refund-requested':'release-requested';
 }else throw new ApiError('Unknown escrow action.');
 const fields=Object.keys(values),update=await db().prepare(`UPDATE escrow_orders SET ${fields.map(k=>k+'=?').join(',')},revision=revision+1,last_actor=?,last_action=?,last_reason=?,updated_at=? WHERE id=? AND revision=? AND settlement NOT IN ('committed','confirmed','frozen') AND NOT EXISTS(SELECT 1 FROM escrow_intents WHERE order_id=? AND state NOT IN ('requested','cancelled'))`).bind(...Object.values(values),userId,String(action),reason,now,id,o.revision,id).run();
 if(!update.meta.changes)throw new ApiError('Concurrent order update. Refresh; no conflicting settlement was authorized.',409);
 return escrowStatus(id,userId);
}
