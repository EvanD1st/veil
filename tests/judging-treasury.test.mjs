// Explicitly synthetic adapters: no wallet RPC, actual currency, key derivation or transfer.
import test from'node:test';import assert from'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{readFileSync}from'node:fs';import{randomUUID}from'node:crypto';
import{Treasury,liveWalletAdapter}from'../judging/treasury.mjs';
const address=JSON.parse(readFileSync('tests/fixtures/synthetic-receiver.json')).address;
function setup(){const db=new DatabaseSync(':memory:'),calls=[],store=new Map();let counter=0;const adapter={evidence:'synthetic-ci-only',async provision({user}){calls.push('provision');const account='fixture-account-'+user;store.set(account,user);return{account,address,independentAuthority:true};},async confirmIndividualBackup(account,answers){return answers===store.get(account);},async balance(account){return{network:'testnet',synchronized:true,account,confirmed:'1000000'};},async readiness(){calls.push('readiness');},async prepare(row){calls.push('prepare');return{...row,fee:'10000',rawHex:'abcd',txid:(++counter).toString(16).padStart(64,'0'),independentlyDecoded:true};},async broadcast(){calls.push('broadcast');throw Error('Lost ACK');},async lookup(txid){calls.push('lookup');return{txid,network:'testnet',activeChain:true,confirmations:3};}};
 const policy={grant:'200000',maxFee:'20000',daily:'220000',total:'440000',maxUsers:2,treasuryAccount:'fixture-treasury'};const service=new Treasury({db,adapter,policy,kill:()=>false,now:()=>100000});return{db,adapter,service,calls,policy};}
const invoice=()=>{const auctionId=randomUUID(),bidId=randomUUID();return{version:1,network:'testnet',invoiceId:'ac'.repeat(32),auctionId,bidId,address,amount:'20000',memo:`VEIL:${auctionId}:${bidId}`};};
test('live adapter always refuses activation, independent backup is checked and no shared recovery is inferred',async()=>{assert.throws(()=>liveWalletAdapter(),/spending remains closed/);const{db,service,calls}=setup();try{assert.deepEqual(await service.activate('a'),{state:'backup-required'});await service.activate('a');assert.equal(calls.filter(x=>x==='provision').length,1);await assert.rejects(service.confirmBackup('a','other-user'));assert.throws(()=>service.requestGrant('a'),/backup/);await service.confirmBackup('a','a');assert.equal((await service.balance('a')).confirmed,'1000000');}finally{db.close();}});
test('grant uniqueness, hard budgets, single broadcast, lost ACK and restart recovery never resend',async()=>{const{db,adapter,service,calls,policy}=setup();try{await service.activate('a');await service.confirmBackup('a','a');const grant=service.requestGrant('a');assert.equal(service.requestGrant('a').id,grant.id);await service.prepare(grant.id);await service.broadcast(grant.id);assert.equal(service.status(grant.id).state,'broadcast-unknown');await assert.rejects(service.broadcast(grant.id));assert.equal(db.prepare('SELECT broadcast_attempts FROM judge_transfers WHERE id=?').get(grant.id).broadcast_attempts,1);db.prepare("UPDATE judge_transfers SET state='prepared' WHERE id=?").run(grant.id);await assert.rejects(service.broadcast(grant.id),/cannot be repeated/);
 const recovered=new Treasury({db,adapter,policy,kill:()=>true});assert.equal((await recovered.reconcile(grant.id)).state,'confirmed');assert.equal(calls.filter(x=>x==='broadcast').length,1);assert.equal(recovered.status(grant.id).deliveryUnlocked,false);
 // A second account cannot receive the same bound address; it freezes instead of silently sharing authority.
 await assert.rejects(service.activate('b'));assert.equal(db.prepare("SELECT state FROM judge_private_wallets WHERE user='b'").get().state,'unavailable');
 db.prepare("UPDATE judge_private_wallets SET wallet_account='fixture-account-b',address=NULL,backup_confirmed=1,state='ready' WHERE user='b'").run();assert.throws(()=>service.requestGrant('b'),/budget/);
}finally{db.close();}});
test('existing private journal gains durable broadcast count without changing retained intent',()=>{const db=new DatabaseSync(':memory:'),adapter={evidence:'synthetic-ci-only'},policy={grant:'1',maxFee:'1',daily:'2',total:'2',maxUsers:1,treasuryAccount:'fixture'};db.exec(`CREATE TABLE judge_transfers(id TEXT PRIMARY KEY,kind TEXT NOT NULL,user TEXT NOT NULL,source TEXT NOT NULL,destination TEXT NOT NULL,amount TEXT NOT NULL,memo TEXT NOT NULL,max_fee TEXT NOT NULL,invoice_id TEXT UNIQUE,day INTEGER NOT NULL,state TEXT NOT NULL,raw_hex TEXT,txid TEXT UNIQUE,fee TEXT,sapling_output INTEGER,expiry_height INTEGER,selector_ack INTEGER NOT NULL DEFAULT 0,selector_next INTEGER NOT NULL DEFAULT 0,selector_failures INTEGER NOT NULL DEFAULT 0,reconcile_next INTEGER NOT NULL DEFAULT 0);INSERT INTO judge_transfers(id,kind,user,source,destination,amount,memo,max_fee,day,state) VALUES('old','purchase','u','s','d','1','m','1',0,'broadcast-unknown');`);try{new Treasury({db,adapter,policy,kill:()=>true});assert.equal(db.prepare("SELECT broadcast_attempts FROM judge_transfers WHERE id='old'").get().broadcast_attempts,0);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}});
test('Pay is explicit, invoice-bound, user-bound and duplicate/concurrent authorization cannot overspend',async()=>{const{db,adapter,service,calls}=setup();try{await service.activate('a');await service.confirmBackup('a','a');const inv=invoice(),get=async(user,id)=>{assert.equal(user,'a');assert.equal(id,inv.auctionId);return inv;};const quote=await service.quote('a',inv.auctionId,get);await assert.rejects(service.pay('a',quote.quoteId,false,get),/explicit/i);await assert.rejects(service.pay('outsider',quote.quoteId,true,get));const first=await service.pay('a',quote.quoteId,true,get);adapter.balance=async()=>{throw Error('Balance cache unavailable after retained intent');};const duplicate=await service.pay('a',quote.quoteId,true,get);assert.equal(first.id,duplicate.id);
 const another={...inv,invoiceId:'ad'.repeat(32)};const q2=await service.quote('a',inv.auctionId,async()=>another);await assert.rejects(service.pay('a',q2.quoteId,true,async()=>another),/pending/);
 adapter.prepare=async()=>{calls.push('prepare');throw Error('Lost preparation response');};await assert.rejects(service.prepare(first.id));await assert.rejects(service.prepare(first.id));assert.equal(calls.filter(x=>x==='prepare').length,1);assert.equal(service.status(first.id).state,'prepare-unknown');assert.equal((await service.reconcile(first.id)).state,'operator-review');
}finally{db.close();}});

// Daily-grant fixtures are synthetic journal transitions; they never sign or send.
async function dailyFixture(overrides={}){
 const f=setup();let stamp=3*86400000+12345;
 const policy={...f.policy,grant:'20000000',maxFee:'20000',daily:'201000000',total:'201000000',grantIntervalMs:86400000,...overrides};
 const service=new Treasury({db:f.db,adapter:f.adapter,policy,kill:()=>false,now:()=>stamp});
 await service.activate('a');await service.confirmBackup('a','a');
 return {...f,service,policy,setTime:n=>stamp=n,getTime:()=>stamp};
}
test('daily grant is exactly 0.2 TAZ, waits a rolling 24 hours and survives service restart',async()=>{
 const f=await dailyFixture();try{
 const first=f.service.requestGrant('a'),start=f.getTime();assert.equal(f.db.prepare('SELECT amount FROM judge_transfers WHERE id=?').get(first.id).amount,'20000000');
 f.db.prepare("UPDATE judge_transfers SET state='confirmed' WHERE id=?").run(first.id);
 f.setTime(start+86400000-1);assert.equal(f.service.requestGrant('a').id,first.id);assert.equal(f.service.grantStatus('a').eligible,false);
 const restarted=new Treasury({db:f.db,adapter:f.adapter,policy:f.policy,kill:()=>false,now:()=>f.getTime()});assert.equal(restarted.requestGrant('a').id,first.id);
 f.setTime(start+86400000);const second=restarted.requestGrant('a');assert.notEqual(second.id,first.id);assert.equal(restarted.requestGrant('a').id,second.id);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM judge_transfers').get().n,2);
 assert.equal(restarted.grantStatus('a').nextEligibleAt,start+2*86400000);
 }finally{f.db.close();}
});
test('pending, uncertain or reorged grants block another daily grant even after the cooldown',async()=>{
 const f=await dailyFixture();try{
 const first=f.service.requestGrant('a');f.setTime(f.getTime()+3*86400000);
 for(const state of ['queued','preparing','prepare-unknown','prepared','broadcast-unknown','submitted']){
 f.db.prepare('UPDATE judge_transfers SET state=? WHERE id=?').run(state,first.id);assert.equal(f.service.requestGrant('a').id,first.id);assert.equal(f.service.grantStatus('a').eligible,false);
 }
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM judge_transfers').get().n,1);
 }finally{f.db.close();}
});
test('daily funding counts distinct accounts and charges fee allowances to both rolling and lifetime budgets',async()=>{
 const f=await dailyFixture({daily:'20020000',total:'40040000',maxUsers:2});try{
 const first=f.service.requestGrant('a');f.db.prepare("UPDATE judge_transfers SET state='confirmed' WHERE id=?").run(first.id);
 // Metadata-only second synthetic account: no real address/keys or funding.
 f.db.prepare("INSERT INTO judge_private_wallets VALUES('b','op-b','ready','account-b','synthetic-b',1)").run();
 assert.throws(()=>f.service.requestGrant('b'),/budget exhausted/);
 f.setTime(f.getTime()+86400000);const second=f.service.requestGrant('a');assert.notEqual(second.id,first.id);
 f.db.prepare("UPDATE judge_transfers SET state='confirmed' WHERE id=?").run(second.id);f.setTime(f.getTime()+86400000);
 assert.throws(()=>f.service.requestGrant('a'),/budget exhausted/);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM judge_transfers').get().n,2);
 }finally{f.db.close();}
});
test('legacy grants retain their identity and conservatively wait from the end of their recorded day',async()=>{
 const f=await dailyFixture();try{
 const first=f.service.requestGrant('a');const row=f.db.prepare('SELECT day FROM judge_transfers WHERE id=?').get(first.id);
 f.db.prepare("UPDATE judge_transfers SET state='confirmed',requested_at=NULL,broadcast_attempts=1 WHERE id=?").run(first.id);
 const next=(row.day+2)*86400000;f.setTime(next-1);assert.equal(f.service.requestGrant('a').id,first.id);assert.equal(f.service.grantStatus('a').nextEligibleAt,next);
 f.setTime(next);assert.notEqual(f.service.requestGrant('a').id,first.id);assert.equal(f.db.prepare('SELECT broadcast_attempts FROM judge_transfers WHERE id=?').get(first.id).broadcast_attempts,1);
 }finally{f.db.close();}
});
test('a clock rollback and unsupported grant intervals never authorize an extra grant',async()=>{
 const f=await dailyFixture();try{
 const first=f.service.requestGrant('a');f.db.prepare("UPDATE judge_transfers SET state='confirmed' WHERE id=?").run(first.id);f.setTime(f.getTime()-1000);assert.equal(f.service.requestGrant('a').id,first.id);
 assert.throws(()=>new Treasury({db:f.db,adapter:f.adapter,policy:{...f.policy,grantIntervalMs:3600000}}),/24-hour/);
 }finally{f.db.close();}
});

test('live grant preparation cannot spend more than the fresh confirmed treasury balance',async()=>{
 const f=await dailyFixture();try{
 const grant=f.service.requestGrant('a');let prepared=false;
 const adapter={...f.adapter,evidence:'live-zingolib-testnet',validated:true,async readiness(){},async refresh(){},async balance(account){return{network:'testnet',account,synchronized:true,confirmed:'20000000'};},async prepare(){prepared=true;throw Error('Must not sign');}};
 const live=new Treasury({db:f.db,adapter,policy:f.policy,kill:()=>false,now:()=>f.getTime()});
 await assert.rejects(live.prepare(grant.id),/Insufficient confirmed treasury/);assert.equal(prepared,false);assert.equal(live.status(grant.id).state,'queued');assert.equal(f.db.prepare('SELECT broadcast_attempts FROM judge_transfers WHERE id=?').get(grant.id).broadcast_attempts,0);
 }finally{f.db.close();}
});

test('a retained confirmed grant is explicitly a cooldown response, never a new funding acceptance',async()=>{
 const f=await dailyFixture();try{
 const first=f.service.requestGrant('a');assert.equal(first.created,true);assert.equal(first.reason,'queued');
 f.db.prepare("UPDATE judge_transfers SET state='confirmed' WHERE id=?").run(first.id);
 const blocked=f.service.requestGrant('a');assert.equal(blocked.created,false);assert.equal(blocked.reason,'cooldown');assert.equal(blocked.state,'confirmed');assert.equal(blocked.nextEligibleAt,f.getTime()+86400000);assert.equal(f.service.grantStatus('a').blockReason,'cooldown');
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM judge_transfers').get().n,1);
 f.db.prepare("UPDATE judge_transfers SET state='broadcast-unknown' WHERE id=?").run(first.id);const uncertain=f.service.requestGrant('a');assert.equal(uncertain.created,false);assert.equal(uncertain.reason,'pending');
 }finally{f.db.close();}
});

// Explicit operator top-ups share the bounded treasury policy; no real transfer.
test('operator top-ups consume the same grant budget and retain the request cooldown',async()=>{
 const f=await dailyFixture({daily:'20020000',total:'20020000'});try{
 const first=f.service.requestGrant('a');f.db.prepare("UPDATE judge_transfers SET kind='operator-topup',state='confirmed' WHERE id=?").run(first.id);
 assert.equal(f.service.grantStatus('a').eligible,false);assert.equal(f.service.requestGrant('a').id,first.id);
 f.setTime(f.getTime()+86400000);assert.throws(()=>f.service.requestGrant('a'),/budget exhausted/);
 }finally{f.db.close();}
});
