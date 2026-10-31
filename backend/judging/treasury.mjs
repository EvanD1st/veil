// Private worker journal, not an application balance ledger. Live spending is
// confined to the AWS adapter's validated capability or an exact approved trial.
import {randomUUID} from 'node:crypto';
import {isSaplingTestnet,validateInvoice} from '../scanner/invoice.mjs';
const amount=v=>{if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,13})$/.test(v))throw Error('Integer zatoshis required.');return BigInt(v);};
const atomic=(db,fn)=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
export const LIVE_CAPABILITY_GATE=Object.freeze({enabled:false,reason:'Managed testnet spending remains closed until funded Zingolib signing, independent restore, exact output inspection, one-broadcast recovery and checkout delivery pass a live test.'});
export function liveWalletAdapter(){throw Error(LIVE_CAPABILITY_GATE.reason);}
export class Treasury{
 constructor({db,adapter,policy,now=Date.now,kill=()=>true}){
  if(!adapter||!['synthetic-ci-only','live-zingolib-testnet'].includes(adapter.evidence))throw Error('No reviewed managed-wallet adapter is available.');
  for(const k of ['grant','maxFee','daily','total'])amount(policy[k]);if(amount(policy.grant)<=0n||amount(policy.maxFee)<=0n||!Number.isSafeInteger(policy.maxUsers)||policy.maxUsers<1||policy.maxUsers>50)throw Error('Invalid bounded funding policy.');
  if(policy.grantIntervalMs!==undefined&&policy.grantIntervalMs!==86400000)throw Error('Recurring grants require a rolling 24-hour interval.');
  Object.assign(this,{db,adapter,policy,now,kill});
  db.exec(`CREATE TABLE IF NOT EXISTS judge_private_wallets(user TEXT PRIMARY KEY,operation TEXT UNIQUE NOT NULL,state TEXT NOT NULL,wallet_account TEXT UNIQUE,address TEXT UNIQUE,backup_confirmed INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS judge_quotes(id TEXT PRIMARY KEY,user TEXT NOT NULL,invoice TEXT NOT NULL,max_fee TEXT NOT NULL,expires INTEGER NOT NULL,consumed INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS judge_transfers(id TEXT PRIMARY KEY,kind TEXT NOT NULL,user TEXT NOT NULL,source TEXT NOT NULL,destination TEXT NOT NULL,amount TEXT NOT NULL,memo TEXT NOT NULL,max_fee TEXT NOT NULL,invoice_id TEXT UNIQUE,day INTEGER NOT NULL,state TEXT NOT NULL,raw_hex TEXT,txid TEXT UNIQUE,fee TEXT,sapling_output INTEGER,expiry_height INTEGER,selector_ack INTEGER NOT NULL DEFAULT 0,selector_next INTEGER NOT NULL DEFAULT 0,selector_failures INTEGER NOT NULL DEFAULT 0,reconcile_next INTEGER NOT NULL DEFAULT 0,broadcast_attempts INTEGER NOT NULL DEFAULT 0);
   CREATE UNIQUE INDEX IF NOT EXISTS judge_one_inflight_source ON judge_transfers(source) WHERE state IN ('preparing','prepare-unknown','prepared','broadcast-unknown','submitted');`);
  // Existing private journals predate the one-broadcast guard. Add the column
  // in place so restart/upgrade never resets a retained transfer's send count.
  if(!db.prepare('PRAGMA table_info(judge_transfers)').all().some(c=>c.name==='broadcast_attempts'))
   db.exec('ALTER TABLE judge_transfers ADD COLUMN broadcast_attempts INTEGER NOT NULL DEFAULT 0');
  if(!db.prepare('PRAGMA table_info(judge_transfers)').all().some(c=>c.name==='requested_at'))db.exec('ALTER TABLE judge_transfers ADD COLUMN requested_at INTEGER');
  atomic(db,()=>{
   if(policy.grantIntervalMs){db.exec("DROP INDEX IF EXISTS judge_one_starter_grant; CREATE UNIQUE INDEX IF NOT EXISTS judge_one_daily_grant ON judge_transfers(user,day) WHERE kind='grant';");}
   else db.exec("CREATE UNIQUE INDEX IF NOT EXISTS judge_one_starter_grant ON judge_transfers(user) WHERE kind='grant';");
  });
 }
 gate(spending=true){if(this.kill())throw Error('Managed-wallet kill switch is active.');if(spending&&this.adapter.evidence==='live-zingolib-testnet'&&this.adapter.validated!==true&&this.adapter.trialApproved!==true)throw Error('Funded signing and checkout validation is required before spending.');}
 async activate(user){this.gate(false);const allocation=atomic(this.db,()=>{const w=this.db.prepare('SELECT * FROM judge_private_wallets WHERE user=?').get(user);if(w)return{existing:w};if(this.db.prepare('SELECT COUNT(*) n FROM judge_private_wallets').get().n>=this.policy.maxUsers)throw Error('Wallet capacity exhausted.');const operation=randomUUID();this.db.prepare("INSERT INTO judge_private_wallets(user,operation,state) VALUES(?,?,'provisioning')").run(user,operation);return{operation};});if(allocation.existing)return{state:allocation.existing.state};const operation=allocation.operation;
  // The adapter must persist separate authority before import and reconcile this operation, never generate again.
  try{const r=await this.adapter.provision({operation,user});if(!r.independentAuthority||!r.account||!isSaplingTestnet(r.address))throw Error();this.db.prepare("UPDATE judge_private_wallets SET wallet_account=?,address=?,state='backup-required' WHERE user=?").run(r.account,r.address,user);return {state:'backup-required'};}
  catch{this.db.prepare("UPDATE judge_private_wallets SET state='unavailable' WHERE user=?").run(user);throw Error('Provisioning uncertain; reconcile retained authority, do not create another wallet.');}
 }
 async confirmBackup(user,answers){this.gate(false);const w=this.wallet(user,false);if(!await this.adapter.confirmIndividualBackup(w.wallet_account,answers))throw Error('Individual backup checkpoint failed.');this.db.prepare("UPDATE judge_private_wallets SET backup_confirmed=1,state='ready' WHERE user=?").run(user);}
 wallet(user,ready=true){const w=this.db.prepare('SELECT * FROM judge_private_wallets WHERE user=?').get(user);if(!w?.wallet_account||ready&&(!w.backup_confirmed||w.state!=='ready'))throw Error('Independent wallet and verified backup required.');return w;}
 async balance(user){const w=this.wallet(user),r=await this.adapter.balance(w.wallet_account);if(r.network!=='testnet'||r.account!==w.wallet_account||r.synchronized!==true)throw Error('Chain-derived balance unavailable.');amount(r.confirmed);return {confirmed:r.confirmed,source:this.adapter.evidence};}
 grantStatus(user){
  const rows=this.db.prepare("SELECT id,kind,user,state,amount,max_fee,day,requested_at FROM judge_transfers WHERE kind IN ('grant','operator-topup') ORDER BY COALESCE(requested_at,(day+1)*86400000) DESC,rowid DESC").all();
  const own=rows.filter(r=>r.user===user),last=own.find(r=>r.kind==='grant'),pending=own.find(r=>r.state!=='confirmed');
  const stamp=this.now();if(!Number.isSafeInteger(stamp)||stamp<0)throw Error('Valid funding clock required.');
  const requested=r=>r.requested_at??(r.day+1)*86400000; // Legacy grants wait conservatively from the end of their recorded UTC day.
  const next=last&&this.policy.grantIntervalMs?requested(last)+this.policy.grantIntervalMs:null;
  const spent=rs=>rs.reduce((n,r)=>n+amount(r.amount)+amount(r.max_fee),0n),cost=amount(this.policy.grant)+amount(this.policy.maxFee);
  const daily=rows.filter(r=>this.policy.grantIntervalMs?requested(r)>stamp-86400000:r.day===Math.floor(stamp/86400000));
  const users=new Set(rows.map(r=>r.user));
  const budget=(!users.has(user)&&users.size>=this.policy.maxUsers)||spent(rows)+cost>amount(this.policy.total)||spent(daily)+cost>amount(this.policy.daily);
  const blockReason=pending?'pending':last&&!this.policy.grantIntervalMs?'already-granted':last&&stamp<next?'cooldown':budget?'budget':null;
  return {last:pending??last,nextEligibleAt:next,blockReason,eligible:!pending&&(!last||!!this.policy.grantIntervalMs&&stamp>=next)&&!budget,budgetExhausted:budget};
 }
 requestGrant(user){this.gate();const w=this.wallet(user);return atomic(this.db,()=>{
  const status=this.grantStatus(user),old=status.last;
  // Pending/uncertain requests retain the same immutable intent even after 24 hours.
  if(old&&(old.state!=='confirmed'||!this.policy.grantIntervalMs||this.now()<status.nextEligibleAt))return {id:old.id,state:old.state,created:false,reason:old.state!=='confirmed'?'pending':this.policy.grantIntervalMs?'cooldown':'already-granted',nextEligibleAt:status.nextEligibleAt};
  if(!status.eligible)throw Error('Starter-funding budget exhausted.');
  this.adapter.authorize?.({kind:'grant',user,source:this.policy.treasuryAccount,destination:w.address,amount:this.policy.grant,memo:'VEIL TESTNET starter grant',max_fee:this.policy.maxFee});
  const id=randomUUID(),stamp=this.now(),day=Math.floor(stamp/86400000);this.db.prepare("INSERT INTO judge_transfers(id,kind,user,source,destination,amount,memo,max_fee,day,state,requested_at) VALUES(?,'grant',?,?,?,?,?,?,?,'queued',?)").run(id,user,this.policy.treasuryAccount,w.address,this.policy.grant,'VEIL TESTNET starter grant',this.policy.maxFee,day,stamp);return {id,state:'queued',created:true,reason:'queued',nextEligibleAt:this.policy.grantIntervalMs?stamp+this.policy.grantIntervalMs:null};
 });}
 async quote(user,auctionId,invoiceFor){this.gate();this.wallet(user);const invoice=await invoiceFor(user,auctionId);validateInvoice(invoice);const id=randomUUID();atomic(this.db,()=>{this.db.prepare('DELETE FROM judge_quotes WHERE expires<?').run(this.now());if(this.db.prepare('SELECT COUNT(*) n FROM judge_quotes').get().n>=200||this.db.prepare('SELECT COUNT(*) n FROM judge_quotes WHERE user=?').get(user).n>=5)throw Error('Payment-review capacity reached.');this.db.prepare('INSERT INTO judge_quotes VALUES(?,?,?,?,?,0)').run(id,user,JSON.stringify(invoice),this.policy.maxFee,this.now()+120000);});return {quoteId:id,network:'testnet',address:invoice.address,amount:invoice.amount,memo:invoice.memo,maxFee:this.policy.maxFee,expiresAt:this.now()+120000};}
 async pay(user,quoteId,affirmative,invoiceFor){this.gate();if(affirmative!==true)throw Error('Explicit Pay authorization required.');const w=this.wallet(user),q=this.db.prepare('SELECT * FROM judge_quotes WHERE id=? AND user=?').get(quoteId,user);if(!q||q.expires<this.now())throw Error('Expired payment review.');const invoice=JSON.parse(q.invoice),current=await invoiceFor(user,invoice.auctionId);if(JSON.stringify(current)!==q.invoice)throw Error('Invoice changed; review again.');
  const retained=this.db.prepare('SELECT id,state,user FROM judge_transfers WHERE invoice_id=?').get(invoice.invoiceId);if(retained){if(retained.user!==user)throw Error('Invoice authorization mismatch.');return {id:retained.id,state:retained.state};}
  if(q.consumed||this.db.prepare("SELECT id FROM judge_transfers WHERE source=? AND state<>'confirmed'").get(w.wallet_account))throw Error('Payment already pending; reconcile it first.');
  const balance=await this.balance(user);if(amount(balance.confirmed)<amount(invoice.amount)+amount(q.max_fee))throw Error('Insufficient confirmed chain funds.');this.adapter.authorize?.({kind:'purchase',user,source:w.wallet_account,destination:invoice.address,amount:invoice.amount,memo:invoice.memo,max_fee:q.max_fee,invoice_id:invoice.invoiceId});
  return atomic(this.db,()=>{const old=this.db.prepare('SELECT id,state FROM judge_transfers WHERE invoice_id=?').get(invoice.invoiceId);if(old){const own=this.db.prepare('SELECT user FROM judge_transfers WHERE id=?').get(old.id);if(own.user!==user)throw Error('Invoice authorization mismatch.');return old;}
   if(q.consumed||this.db.prepare("SELECT id FROM judge_transfers WHERE source=? AND state<>'confirmed'").get(w.wallet_account))throw Error('Payment already pending; reconcile it first.');
   const id=randomUUID();this.db.prepare("INSERT INTO judge_transfers(id,kind,user,source,destination,amount,memo,max_fee,invoice_id,day,state) VALUES(?,'purchase',?,?,?,?,?,?,?,?, 'queued')").run(id,user,w.wallet_account,invoice.address,invoice.amount,invoice.memo,q.max_fee,invoice.invoiceId,Math.floor(this.now()/86400000));this.db.prepare('UPDATE judge_quotes SET consumed=1 WHERE id=?').run(q.id);return {id,state:'queued'};
  });
 }
 async prepare(id){this.gate();const row=this.db.prepare('SELECT * FROM judge_transfers WHERE id=?').get(id);if(!row||row.state!=='queued')throw Error('Preparation cannot be retried.');this.adapter.authorize?.(row);await this.adapter.readiness();
  if(row.kind==='grant'&&this.adapter.evidence==='live-zingolib-testnet'){
   await this.adapter.refresh(row.source);const balance=await this.adapter.balance(row.source);
   if(balance.network!=='testnet'||balance.account!==row.source||balance.synchronized!==true||amount(balance.confirmed)<amount(row.amount)+amount(row.max_fee))throw Error('Insufficient confirmed treasury funds; the retained grant remains queued.');
  }
  if(!this.db.prepare("UPDATE judge_transfers SET state='preparing' WHERE id=? AND state='queued'").run(id).changes)throw Error('Concurrent preparation refused.');
  try{const p=await this.adapter.prepare(row);if(!p||p.source!==row.source||p.destination!==row.destination||p.amount!==row.amount||p.memo!==row.memo||amount(p.fee)>amount(row.max_fee)||!/^([a-f0-9]{2}){1,2000000}$/.test(p.rawHex)||!/^[a-f0-9]{64}$/.test(p.txid)||p.independentlyDecoded!==true)throw Error();if(this.adapter.evidence==='live-zingolib-testnet'&&(!Number.isInteger(p.output)||p.output<0||p.output>65535||!Number.isInteger(p.expiryHeight)))throw Error();this.db.prepare("UPDATE judge_transfers SET state='prepared',raw_hex=?,txid=?,fee=?,sapling_output=?,expiry_height=? WHERE id=?").run(p.rawHex,p.txid,p.fee,p.output??null,p.expiryHeight??null,id);return {state:'prepared'};}
  catch{this.db.prepare("UPDATE judge_transfers SET state='prepare-unknown' WHERE id=?").run(id);throw Error('Preparation uncertain; retained intent requires private reconciliation.');}
 }
 async broadcast(id){this.gate();const row=this.db.prepare('SELECT * FROM judge_transfers WHERE id=?').get(id);if(!row||row.state!=='prepared'||row.broadcast_attempts)throw Error('Broadcast cannot be repeated.');this.adapter.authorize?.(row);await this.adapter.readiness();if(this.adapter.evidence==='live-zingolib-testnet'){const checked=await this.adapter.inspect(row);if(checked.txid!==row.txid||checked.rawHex!==row.raw_hex||checked.fee!==row.fee||checked.output!==row.sapling_output||checked.expiryHeight!==row.expiry_height||checked.independentlyDecoded!==true)throw Error('Retained transaction inspection failed.');}this.gate();if(!this.db.prepare("UPDATE judge_transfers SET state='broadcast-unknown',broadcast_attempts=broadcast_attempts+1 WHERE id=? AND state='prepared' AND broadcast_attempts=0").run(id).changes)throw Error('Concurrent broadcast refused.');
  try{if(await this.adapter.broadcast(row.raw_hex)!==row.txid)throw Error();this.db.prepare("UPDATE judge_transfers SET state='submitted' WHERE id=?").run(id);}catch{/* Keep immutable bytes/txid; a timeout never means resend. */}return this.status(id);
 }
 async reconcile(id){const row=this.db.prepare('SELECT * FROM judge_transfers WHERE id=?').get(id);if(!row?.txid)return {state:'operator-review'};const r=await this.adapter.lookup(row.txid);
  if(r?.txid===row.txid&&r.network==='testnet'&&r.activeChain===true&&Number.isSafeInteger(r.confirmations)&&r.confirmations>=3){this.db.prepare("UPDATE judge_transfers SET state='confirmed' WHERE id=?").run(id);}else if(row.state==='confirmed'){this.db.prepare("UPDATE judge_transfers SET state='broadcast-unknown' WHERE id=?").run(id);}return this.status(id);
 }
 status(id){const r=this.db.prepare('SELECT state,kind FROM judge_transfers WHERE id=?').get(id);return {...r,evidence:this.adapter.evidence,deliveryUnlocked:false};}
}
