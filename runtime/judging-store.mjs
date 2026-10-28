import {randomUUID,randomBytes,createHash} from 'node:crypto';
import collection from '../judging/collection.json' with {type:'json'};
export const COLLECTION=collection;
export const WALLET_BLOCKER='Independent recovery and recoverable outgoing spending have not passed validation on the installed experimental wallet. No wallet or starter funds have been created for this request.';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export class JudgingError extends Error{constructor(message,status=409){super(message);this.status=status;}}
const fail=(message,status)=>{throw new JudgingError(message,status);};
function atomic(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
export function windowSeconds(value='3024000'){
 if(typeof value!=='string'||!/^\d+$/.test(value)||Number(value)<60||Number(value)>3024000)fail('Bidding window must be 60 seconds to 35 days.',503);
 return Number(value);
}
export function registerFamily(db,{slug,previewId,fileId},seller,manifest,now=Date.now()){
 const family=collection.find(f=>f.slug===slug),expected=manifest.objects?.find(f=>f.slug===slug);
 if(!family||!expected||!/^[a-f0-9]{64}$/.test(expected.sha256))fail('Collection import has not been reviewed.',503);
 const file=db.prepare("SELECT * FROM digital_assets WHERE id=? AND owner_id=? AND kind='deliverable' AND state='complete'").get(fileId,seller);
 const preview=db.prepare("SELECT * FROM digital_assets WHERE id=? AND owner_id=? AND kind='preview' AND state='complete'").get(previewId,seller);
 if(!file||!preview||file.format!=='png'||file.bytes!==family.bytes||file.sha256!==expected.sha256)fail('Upload the exact selected original and a sanitized preview through the normal file endpoint.');
 return atomic(db,()=>{const old=db.prepare('SELECT * FROM judging_families WHERE slug=?').get(slug);if(old){if(old.file_id!==fileId||old.preview_id!==previewId)fail('This family already has frozen files.');return {registered:true};}
 db.prepare('INSERT INTO judging_families VALUES(?,?,?,?)').run(slug,previewId,fileId,now);return {registered:true};});
}
export function reserveEdition(db,slug,{seconds=3024000,now=Date.now(),maxEditions=5}={}){
 windowSeconds(String(seconds));if(!collection.some(f=>f.slug===slug))fail('Unknown artwork.',404);
 return atomic(db,()=>{
  const family=db.prepare('SELECT * FROM judging_families WHERE slug=?').get(slug);if(!family)fail('The protected artwork is not imported.',503);
  const previous=db.prepare("SELECT * FROM judging_editions WHERE family=? AND state<>'verified'").get(slug);
  if(previous)return {...previous,reused:true,previewId:family.preview_id,fileId:family.file_id};
  const n=db.prepare('SELECT COALESCE(MAX(edition),0)+1 n FROM judging_editions WHERE family=?').get(slug).n;
  if(n>maxEditions)fail('The edition budget for this artwork is exhausted.',429);
  const id=randomUUID(),auction=randomUUID();db.prepare("INSERT INTO judging_editions VALUES(?,?,?,?,?,'preparing',NULL,?)").run(id,slug,n,auction,now+seconds*1000,now);
  return {...db.prepare('SELECT * FROM judging_editions WHERE id=?').get(id),reused:false,previewId:family.preview_id,fileId:family.file_id};
 });
}
export function bindEdition(db,id,seller,now=Date.now()){
 return atomic(db,()=>{const e=db.prepare('SELECT * FROM judging_editions WHERE id=?').get(id);if(!e)fail('Edition not found.',404);
 const a=db.prepare('SELECT * FROM auctions WHERE id=?').get(e.auction_id),l=db.prepare('SELECT * FROM digital_listings WHERE auction_id=?').get(e.auction_id),f=db.prepare('SELECT * FROM judging_families WHERE slug=?').get(e.family),meta=collection.find(f=>f.slug===e.family);
 if(!a||!l||a.owner_id!==seller||a.closes_at!==e.closes_at||a.protocol_version!==2||l.file_id!==f.file_id||l.preview_id!==f.preview_id||l.license!==meta.license||l.edition!==`Testnet edition ${e.edition} / up to 5; artwork reused`||a.title!==meta.title+' · Testnet #'+e.edition)fail('The normal validated auction does not match this reserved edition.');
 if(e.state==='preparing'){db.prepare("UPDATE judging_editions SET state='open',updated_at=? WHERE id=?").run(now,id);db.prepare('DELETE FROM judging_edition_requests WHERE family=?').run(e.family);}return {bound:true,auctionId:a.id};});
}
export function catalogue(db,now=Date.now()){
 return collection.map(f=>{const e=db.prepare('SELECT e.*,a.result,a.seller_name,a.reserve,a.created_at,(SELECT COUNT(*) FROM bids WHERE auction_id=a.id) bid_count FROM judging_editions e LEFT JOIN auctions a ON a.id=e.auction_id WHERE e.family=? ORDER BY e.edition DESC LIMIT 1').get(f.slug);
  let result;try{result=e?.result?JSON.parse(e.result):null;}catch{}
  return {...f,current:e?{auctionId:e.state==='preparing'?null:e.auction_id,edition:e.edition,opensAt:e.created_at,closesAt:e.closes_at,
   state:result?.status==='zk-verified'?'verified':e.state==='open'&&now>=e.closes_at?'waiting':e.state,
   sellerName:e.state==='preparing'?null:e.seller_name,startingBid:e.state==='preparing'?null:e.reserve,
   bidCount:e.bid_count??0,capacity:8,winningAmount:result?.status==='zk-verified'?result.amount:null,
   reason:e.state==='failed'?'Automatic reveal needs operator review. Every accepted bid is retained.':null}:null};
 });
}
export function claimProof(db,{now=Date.now(),leaseMs=1800000}={}){
 if(leaseMs<60000||leaseMs>1800000)fail('Invalid worker lease.');
 return atomic(db,()=>{const lease=db.prepare('SELECT * FROM judging_worker_lease WHERE singleton=1').get();if(lease.expires_at>now)return null;
  // First reconcile already published results; never generate a replacement result.
  for(const e of db.prepare("SELECT e.id,a.result FROM judging_editions e JOIN auctions a ON a.id=e.auction_id WHERE e.state IN ('open','proving','publishing','failed') AND a.result IS NOT NULL").all()){
   if(JSON.parse(e.result).status==='zk-verified')db.prepare("UPDATE judging_editions SET state='verified',reason=NULL,updated_at=? WHERE id=?").run(now,e.id);
  }
  const e=db.prepare("SELECT e.* FROM judging_editions e JOIN auctions a ON a.id=e.auction_id WHERE e.state IN ('open','proving','publishing') AND e.closes_at<=? AND a.result IS NULL ORDER BY e.closes_at LIMIT 1").get(now);if(!e)return null;
  const token=randomBytes(32).toString('hex');db.prepare('UPDATE judging_worker_lease SET edition_id=?,token_hash=?,expires_at=? WHERE singleton=1').run(e.id,hash(token),now+leaseMs);
  db.prepare("UPDATE judging_editions SET state='proving',updated_at=? WHERE id=?").run(now,e.id);return {id:e.id,auctionId:e.auction_id,token,expiresAt:now+leaseMs};
 });
}
export function finishProof(db,id,token,phase,now=Date.now()){
 if(!['publishing','failed','verified'].includes(phase))fail('Invalid worker phase.');
 return atomic(db,()=>{const l=db.prepare('SELECT * FROM judging_worker_lease WHERE singleton=1').get();if(l.edition_id!==id||l.token_hash!==hash(token)||l.expires_at<=now)fail('Worker lease expired.');
 const e=db.prepare('SELECT * FROM judging_editions WHERE id=?').get(id);
 if(phase==='verified'){const a=db.prepare('SELECT result FROM auctions WHERE id=?').get(e.auction_id);if(!a?.result||JSON.parse(a.result).status!=='zk-verified')fail('A real verifier-accepted published result is required.');}
 db.prepare('UPDATE judging_editions SET state=?,reason=?,updated_at=? WHERE id=?').run(phase,phase==='failed'?'operator-review':null,now,id);
 if(phase!=='publishing')db.prepare('UPDATE judging_worker_lease SET expires_at=0,token_hash=NULL,edition_id=NULL WHERE singleton=1').run();return {state:phase};});
}
export function walletStatus(db,user){const r=db.prepare('SELECT state FROM judging_wallet_requests WHERE account_id=?').get(user);return {state:r?.state??'not-activated',network:'testnet',custody:'managed-if-activated',address:null,balanceZatoshis:null,starterFunds:'unavailable',backupAvailable:false,canPay:false,reason:WALLET_BLOCKER};}
export function requestWallet(db,user,now=Date.now()){
 // Deliberately no financial adapter: a durable request never fabricates a wallet.
 return atomic(db,()=>{const r=db.prepare('SELECT * FROM judging_wallet_requests WHERE account_id=?').get(user);if(!r){if(db.prepare('SELECT COUNT(*) n FROM judging_wallet_requests').get().n>=200)fail('Provisioning request capacity reached. Retry later.',429);db.prepare("INSERT INTO judging_wallet_requests VALUES(?,?,'blocked',?,?)").run(user,randomUUID(),now,now);}return walletStatus(db,user);});
}
export function requestEdition(db,user,slug,now=Date.now()){
 if(!collection.some(f=>f.slug===slug))fail('Unknown artwork.',404);
 return atomic(db,()=>{const current=db.prepare("SELECT e.state,(SELECT COUNT(*) FROM bids WHERE auction_id=e.auction_id) bids FROM judging_editions e WHERE family=? AND state<>'verified'").get(slug);if(current&&!(current.state==='open'&&current.bids>=8))return {state:current.state};
 if(db.prepare('SELECT COUNT(*) n FROM judging_editions WHERE family=?').get(slug).n>=5)fail('The five-edition test budget is exhausted.',429);
 if(db.prepare('SELECT COUNT(*) n FROM judging_edition_requests').get().n>=200)fail('Edition request capacity reached.',429);
 db.prepare('INSERT OR IGNORE INTO judging_edition_requests VALUES(?,?,?)').run(user,slug,now);return {state:current?'queued-after-current-edition':'requested'};});
}
