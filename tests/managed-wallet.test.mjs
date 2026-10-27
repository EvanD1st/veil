// Synthetic transport/key fixtures only. These tests never claim live funds.
import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {createManagedService,createManagedSelectorDelivery} from '../judging/managed-service.mjs';
import {canonicalManagedInvoice,acceptManagedSelector} from '../judging/managed-client.mjs';
const address=JSON.parse(readFileSync('tests/fixtures/synthetic-receiver.json')).address;
test('selector bearer is restricted to the private reverse-tunnel URL',async()=>{let seen;const deliver=createManagedSelectorDelivery({websiteOrigin:'https://ve-il.duckdns.org',token:'a'.repeat(64),fetchImpl:async(url,options)=>{seen={url,options};return{ok:true,json:async()=>({accepted:true})};}});await deliver({txid:'b'.repeat(64)});assert.equal(seen.url,'http://127.0.0.1:19070/api/judging/managed/selector');assert.equal(seen.options.redirect,'error');assert.equal(seen.options.headers.Authorization,'Bearer '+'a'.repeat(64));await assert.rejects(createManagedSelectorDelivery({websiteOrigin:'https://ve-il.duckdns.org',selectorUrl:'https://ve-il.duckdns.org/api/judging/managed/selector',token:'a'.repeat(64)} )({}),/private selector tunnel/i);});
function fixture(options={}){const db=new DatabaseSync(':memory:');let stamp=100000,valid=true;
 const adapter={evidence:'synthetic-ci-only',validated:true,cache:new Map(),async provision({operation}){this.cache.set(operation,{observedAt:stamp,confirmed:'1000000',synchronized:true});return {account:operation,address,independentAuthority:true};},async backup(){return {seed:Array.from({length:24},(_,n)=>'fixtureword'+n).join(' '),birthday:4546000,address};},async confirmIndividualBackup(_account,answers){return answers.every(a=>a.word==='fixtureword'+(a.index-1));},async balance(account){return {network:'testnet',account,confirmed:'1000000',synchronized:true};},async readiness(){},async refresh(account){this.cache.set(account,{observedAt:stamp,confirmed:'1000000',synchronized:true});}};
 const policy={grant:'200000',maxFee:'20000',daily:'220000',total:'220000',maxUsers:2,treasuryAccount:randomUUID()},app=createManagedService({db,adapter,policy,token:'a'.repeat(64),kill:()=>!valid,now:()=>stamp,...options});return {db,adapter,app,setTime:t=>stamp=t,kill:()=>valid=false};}
test('private HTTP requires separate bearer auth, account backup challenge survives wrong answers and state never exports secrets',async()=>{
 const f=fixture();await new Promise(r=>f.app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+f.app.server.address().port+'/v1';
 const request=(action,user,input={},auth=true)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+'a'.repeat(64)}:{})},body:JSON.stringify({action,user,input})});
 try{
  assert.equal((await request('state','a',{},false)).status,401);
  await request('activate','a');await f.app.idle();assert.equal((await f.app.state('a')).state,'backup-required');
  assert.equal((await f.app.state('b')).address,null);await assert.rejects(f.app.dispatch('fund','b',{}));
  const backup=await f.app.dispatch('backup','a',{});assert.equal(new Set(backup.positions).size,3);
  const wrong=backup.positions.map(index=>({index,word:'wrong'}));await assert.rejects(f.app.dispatch('confirm-backup','a',{answers:wrong}));
  assert.equal(f.db.prepare('SELECT attempts FROM managed_backup_challenges').get().attempts,1);
  await f.app.dispatch('confirm-backup','a',{answers:backup.positions.map(index=>({index,word:'fixtureword'+(index-1)}))});
  assert.equal((await f.app.state('a')).state,'ready');assert.doesNotMatch(JSON.stringify(await f.app.state('a')),/fixtureword/);
  const a=await f.app.dispatch('fund','a',{}),b=await f.app.dispatch('fund','a',{});assert.equal(a.id,b.id);
  f.setTime(300001);assert.equal((await f.app.state('a')).balanceZatoshis,null);assert.equal((await f.app.state('a')).canPay,false);
  f.kill();await assert.rejects(f.app.dispatch('fund','a',{}));
 }finally{await f.app.idle();f.app.close();f.db.close();}
});
test('a declared live adapter cannot spend merely because an environment or browser enables the feature',async()=>{
 const f=fixture();try{f.adapter.evidence='live-zingolib-testnet';f.adapter.validated=false;await f.app.dispatch('activate','a',{});await f.app.idle();const b=await f.app.dispatch('backup','a',{});await f.app.dispatch('confirm-backup','a',{answers:b.positions.map(index=>({index,word:'fixtureword'+(index-1)}))});assert.equal((await f.app.state('a')).canPay,false);await assert.rejects(f.app.dispatch('fund','a',{}),/validation/);}finally{f.app.close();f.db.close();}
});
test('canonical checkout and narrow selector callback enforce winner, memo/hash binding and durable idempotence without confirming payment',()=>{
 const db=new DatabaseSync(':memory:'),auctionId=randomUUID(),bidId=randomUUID();db.exec(`CREATE TABLE auctions(id TEXT PRIMARY KEY,owner_id TEXT,payment_address TEXT,payment_mode TEXT,result TEXT);CREATE TABLE bids(id TEXT,auction_id TEXT,bidder_id TEXT);CREATE TABLE payment_reports(auction_id TEXT,signed_report TEXT);`);db.exec(readFileSync('drizzle/0004_payment_scan_queue.sql','utf8'));
 db.prepare('INSERT INTO auctions VALUES(?,?,?,?,?)').run(auctionId,'seller',address,'direct',JSON.stringify({winnerId:bidId,status:'zk-verified',amount:'20000',snapshotHash:'b'.repeat(64),declaredAt:100}));db.prepare('INSERT INTO bids VALUES(?,?,?)').run(bidId,auctionId,'winner');
 try{
  for(const who of ['seller','loser','observer'])assert.throws(()=>canonicalManagedInvoice(db,who,auctionId));
  const invoice=canonicalManagedInvoice(db,'winner',auctionId);assert.equal(invoice.memo,`VEIL:${auctionId}:${bidId}`);
  const body={user:'winner',auctionId,invoiceId:invoice.invoiceId,txid:'c'.repeat(64),output:1};assert.deepEqual(acceptManagedSelector(db,body),{accepted:true});assert.deepEqual(acceptManagedSelector(db,body),{accepted:true});
  assert.throws(()=>acceptManagedSelector(db,{...body,output:2}));assert.throws(()=>acceptManagedSelector(db,{...body,user:'observer'}));assert.throws(()=>acceptManagedSelector(db,{...body,invoiceId:'d'.repeat(64)}));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM payment_reports').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM payment_scan_jobs').get().n,1);
 }finally{db.close();}
});
test('selector delivery reconciles a lost acknowledgement from the durable outbox without signing or broadcasting again',async()=>{
 let calls=0;const seen=new Set();const f=fixture({deliverSelector:async body=>{seen.add(body.txid);if(++calls===1)throw Error('Synthetic lost ACK');}});
 try{
  f.db.prepare("INSERT INTO judge_transfers(id,kind,user,source,destination,amount,memo,max_fee,invoice_id,day,state,txid,sapling_output) VALUES(?,'purchase','a','source',?,'20000',?,'20000',?,0,'submitted',?,0)").run(randomUUID(),address,`VEIL:${randomUUID()}:${randomUUID()}`,'e'.repeat(64),'f'.repeat(64));
  await f.app.tick();await f.app.idle();assert.equal(calls,1);assert.equal(f.db.prepare('SELECT selector_ack FROM judge_transfers').get().selector_ack,0);
  f.setTime(130001);await f.app.tick();await f.app.idle();assert.equal(calls,2);assert.equal(seen.size,1);assert.equal(f.db.prepare('SELECT selector_ack FROM judge_transfers').get().selector_ack,1);
 }finally{f.app.close();f.db.close();}
});
