// Private worker journal, NOT an application balance ledger. No live factory is enabled.
import {randomUUID} from 'node:crypto';
import {isSaplingTestnet,validateInvoice} from '../scanner/invoice.mjs';
const amount=v=>{if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,13})$/.test(v))throw Error('Integer zatoshis required.');return BigInt(v);};
const atomic=(db,fn)=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
export const LIVE_CAPABILITY_GATE=Object.freeze({enabled:false,reason:'Pinned zallet pczt_sign cannot sign standalone imported keys without seed derivation hints; online independent-seed backup/provisioning, fee inspection, independent restoration and outgoing recovery remain unvalidated.'});
export function liveWalletAdapter(){throw Error(LIVE_CAPABILITY_GATE.reason);}
export class Treasury{
 constructor({db,adapter,policy,now=Date.now,kill=()=>true}){
  if(!adapter||!(adapter.evidence==='synthetic-ci-only'||adapter.evidence==='live-zingolib-testnet'&&adapter.validated===true))throw Error('No validated live managed-wallet adapter is available.');
  for(const k of ['grant','maxFee','daily','total'])amount(policy[k]);if(amount(policy.grant)<=0n||amount(policy.maxFee)<=0n||!Number.isSafeInteger(policy.maxUsers)||policy.maxUsers<1||policy.maxUsers>50)throw Error('Invalid bounded funding policy.');
  Object.assign(this,{db,adapter,policy,now,kill});
  db.exec(`CREATE TABLE IF NOT EXISTS judge_private_wallets(user TEXT PRIMARY KEY,operation TEXT UNIQUE NOT NULL,state TEXT NOT NULL,wallet_account TEXT UNIQUE,address TEXT UNIQUE,backup_confirmed INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS judge_quotes(id TEXT PRIMARY KEY,user TEXT NOT NULL,invoice TEXT NOT NULL,max_fee TEXT NOT NULL,expires INTEGER NOT NULL,consumed INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS judge_transfers(id TEXT PRIMARY KEY,kind TEXT NOT NULL,user TEXT NOT NULL,source TEXT NOT NULL,destination TEXT NOT NULL,amount TEXT NOT NULL,memo TEXT NOT NULL,max_fee TEXT NOT NULL,invoice_id TEXT UNIQUE,day INTEGER NOT NULL,state TEXT NOT NULL,raw_hex TEXT,txid TEXT UNIQUE,fee TEXT);
   CREATE UNIQUE INDEX IF NOT EXISTS judge_one_starter_grant ON judge_transfers(user) WHERE kind='grant';
   CREATE UNIQUE INDEX IF NOT EXISTS judge_one_inflight_source ON judge_transfers(source) WHERE state IN ('preparing','prepare-unknown','prepared','broadcast-unknown','submitted');`);
 }
 gate(){if(this.kill())throw Error('Managed-wallet kill switch is active.');}
 async activate(user){this.gate();const allocation=atomic(this.db,()=>{const w=this.db.prepare('SELECT * FROM judge_private_wallets WHERE user=?').get(user);if(w)return{existing:w};if(this.db.prepare('SELECT COUNT(*) n FROM judge_private_wallets').get().n>=this.policy.maxUsers)throw Error('Wallet capacity exhausted.');const operation=randomUUID();this.db.prepare("INSERT INTO judge_private_wallets(user,operation,state) VALUES(?,?,'provisioning')").run(user,operation);return{operation};});if(allocation.existing)return{state:allocation.existing.state};const operation=allocation.operation;
  // The adapter must persist separate authority before import and reconcile this operation, never generate again.
  try{const r=await this.adapter.provision({operation,user});if(!r.independentAuthority||!r.account||!isSaplingTestnet(r.address))throw Error();this.db.prepare("UPDATE judge_private_wallets SET wallet_account=?,address=?,state='backup-required' WHERE user=?").run(r.account,r.address,user);return {state:'backup-required'};}
  catch{this.db.prepare("UPDATE judge_private_wallets SET state='unavailable' WHERE user=?").run(user);throw Error('Provisioning uncertain; reconcile retained authority, do not create another wallet.');}
 }
 async confirmBackup(user,answers){this.gate();const w=this.wallet(user,false);if(!await this.adapter.confirmIndividualBackup(w.wallet_account,answers))throw Error('Individual backup checkpoint failed.');this.db.prepare("UPDATE judge_private_wallets SET backup_confirmed=1,state='ready' WHERE user=?").run(user);}
 wallet(user,ready=true){const w=this.db.prepare('SELECT * FROM judge_private_wallets WHERE user=?').get(user);if(!w?.wallet_account||ready&&(!w.backup_confirmed||w.state!=='ready'))throw Error('Independent wallet and verified backup required.');return w;}
 async balance(user){const w=this.wallet(user),r=await this.adapter.balance(w.wallet_account);if(r.network!=='testnet'||r.account!==w.wallet_account||r.synchronized!==true)throw Error('Chain-derived balance unavailable.');amount(r.confirmed);return {confirmed:r.confirmed,source:this.adapter.evidence};}
 requestGrant(user){this.gate();const w=this.wallet(user);return atomic(this.db,()=>{
  const old=this.db.prepare("SELECT id,state FROM judge_transfers WHERE kind='grant' AND user=?").get(user);if(old)return old;
  const rows=this.db.prepare("SELECT amount,max_fee,day FROM judge_transfers WHERE kind='grant'").all(),day=Math.floor(this.now()/86400000),cost=amount(this.policy.grant)+amount(this.policy.maxFee);
  const spent=rs=>rs.reduce((n,r)=>n+amount(r.amount)+amount(r.max_fee),0n);
  if(rows.length>=this.policy.maxUsers||spent(rows)+cost>amount(this.policy.total)||spent(rows.filter(r=>r.day===day))+cost>amount(this.policy.daily))throw Error('Starter-funding budget exhausted.');
  const id=randomUUID();this.db.prepare("INSERT INTO judge_transfers(id,kind,user,source,destination,amount,memo,max_fee,day,state) VALUES(?,'grant',?,?,?,?,?,?,?,'queued')").run(id,user,this.policy.treasuryAccount,w.address,this.policy.grant,'VEIL TESTNET starter grant',this.policy.maxFee,day);return {id,state:'queued'};
 });}
 async quote(user,auctionId,invoiceFor){this.gate();this.wallet(user);const invoice=await invoiceFor(user,auctionId);validateInvoice(invoice);const id=randomUUID();atomic(this.db,()=>{this.db.prepare('DELETE FROM judge_quotes WHERE expires<?').run(this.now());if(this.db.prepare('SELECT COUNT(*) n FROM judge_quotes').get().n>=200||this.db.prepare('SELECT COUNT(*) n FROM judge_quotes WHERE user=?').get(user).n>=5)throw Error('Payment-review capacity reached.');this.db.prepare('INSERT INTO judge_quotes VALUES(?,?,?,?,?,0)').run(id,user,JSON.stringify(invoice),this.policy.maxFee,this.now()+120000);});return {quoteId:id,network:'testnet',address:invoice.address,amount:invoice.amount,memo:invoice.memo,maxFee:this.policy.maxFee,expiresAt:this.now()+120000};}
 async pay(user,quoteId,affirmative,invoiceFor){this.gate();if(affirmative!==true)throw Error('Explicit Pay authorization required.');const w=this.wallet(user),q=this.db.prepare('SELECT * FROM judge_quotes WHERE id=? AND user=?').get(quoteId,user);if(!q||q.expires<this.now())throw Error('Expired payment review.');const invoice=JSON.parse(q.invoice),current=await invoiceFor(user,invoice.auctionId);if(JSON.stringify(current)!==q.invoice)throw Error('Invoice changed; review again.');
  const balance=await this.balance(user);if(amount(balance.confirmed)<amount(invoice.amount)+amount(q.max_fee))throw Error('Insufficient confirmed chain funds.');
  return atomic(this.db,()=>{const old=this.db.prepare('SELECT id,state FROM judge_transfers WHERE invoice_id=?').get(invoice.invoiceId);if(old){const own=this.db.prepare('SELECT user FROM judge_transfers WHERE id=?').get(old.id);if(own.user!==user)throw Error('Invoice authorization mismatch.');return old;}
   if(q.consumed||this.db.prepare("SELECT id FROM judge_transfers WHERE source=? AND state<>'confirmed'").get(w.wallet_account))throw Error('Payment already pending; reconcile it first.');
   const id=randomUUID();this.db.prepare("INSERT INTO judge_transfers(id,kind,user,source,destination,amount,memo,max_fee,invoice_id,day,state) VALUES(?,'purchase',?,?,?,?,?,?,?,?, 'queued')").run(id,user,w.wallet_account,invoice.address,invoice.amount,invoice.memo,q.max_fee,invoice.invoiceId,Math.floor(this.now()/86400000));this.db.prepare('UPDATE judge_quotes SET consumed=1 WHERE id=?').run(q.id);return {id,state:'queued'};
  });
 }
 async prepare(id){this.gate();const row=this.db.prepare('SELECT * FROM judge_transfers WHERE id=?').get(id);if(!row||row.state!=='queued')throw Error('Preparation cannot be retried.');await this.adapter.readiness();
  if(!this.db.prepare("UPDATE judge_transfers SET state='preparing' WHERE id=? AND state='queued'").run(id).changes)throw Error('Concurrent preparation refused.');
  try{const p=await this.adapter.prepare(row);if(!p||p.source!==row.source||p.destination!==row.destination||p.amount!==row.amount||p.memo!==row.memo||amount(p.fee)>amount(row.max_fee)||!/^([a-f0-9]{2}){1,2000000}$/.test(p.rawHex)||!/^[a-f0-9]{64}$/.test(p.txid)||p.independentlyDecoded!==true)throw Error();this.db.prepare("UPDATE judge_transfers SET state='prepared',raw_hex=?,txid=?,fee=? WHERE id=?").run(p.rawHex,p.txid,p.fee,id);return {state:'prepared'};}
  catch{this.db.prepare("UPDATE judge_transfers SET state='prepare-unknown' WHERE id=?").run(id);throw Error('Preparation uncertain; retained intent requires private reconciliation.');}
 }
 async broadcast(id){this.gate();const row=this.db.prepare('SELECT * FROM judge_transfers WHERE id=?').get(id);if(!row||row.state!=='prepared')throw Error('Broadcast cannot be repeated.');await this.adapter.readiness();this.gate();if(!this.db.prepare("UPDATE judge_transfers SET state='broadcast-unknown' WHERE id=? AND state='prepared'").run(id).changes)throw Error('Concurrent broadcast refused.');
  try{if(await this.adapter.broadcast(row.raw_hex)!==row.txid)throw Error();this.db.prepare("UPDATE judge_transfers SET state='submitted' WHERE id=?").run(id);}catch{/* Keep immutable bytes/txid; a timeout never means resend. */}return this.status(id);
 }
 async reconcile(id){const row=this.db.prepare('SELECT * FROM judge_transfers WHERE id=?').get(id);if(!row?.txid)return {state:'operator-review'};const r=await this.adapter.lookup(row.txid);
  if(r?.txid===row.txid&&r.network==='testnet'&&r.activeChain===true&&Number.isSafeInteger(r.confirmations)&&r.confirmations>=3){this.db.prepare("UPDATE judge_transfers SET state='confirmed' WHERE id=?").run(id);}else if(row.state==='confirmed'){this.db.prepare("UPDATE judge_transfers SET state='broadcast-unknown' WHERE id=?").run(id);}return this.status(id);
 }
 status(id){const r=this.db.prepare('SELECT state,kind FROM judge_transfers WHERE id=?').get(id);return {...r,evidence:this.adapter.evidence,deliveryUnlocked:false};}
}
