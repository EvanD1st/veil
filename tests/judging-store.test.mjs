// Store/state fixtures only. Fake result JSON below is NOT cryptographic or live-payment evidence.
import test from 'node:test';import assert from 'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{readFileSync,readdirSync}from'node:fs';import{randomUUID}from'node:crypto';
import{COLLECTION,registerFamily,reserveEdition,bindEdition,catalogue,claimProof,finishProof,requestWallet,walletStatus,requestEdition,windowSeconds}from'../runtime/judging-store.mjs';
const receiver=JSON.parse(readFileSync('tests/fixtures/synthetic-receiver.json')).address;
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));const meta=COLLECTION[0],p='01'.repeat(16),f='02'.repeat(16),seller='private-demo-account';
 for(const [id,kind,bytes]of[[p,'preview',100],[f,'deliverable',meta.bytes]])db.prepare("INSERT INTO digital_assets VALUES(?,?,?,'png','image/png','complete',?,?,?,0)").run(id,seller,kind,bytes,bytes,'ab'.repeat(32));
 registerFamily(db,{slug:meta.slug,previewId:p,fileId:f},seller,{objects:[{slug:meta.slug,sha256:'ab'.repeat(32)}]});
 function auction(e){const draft=randomUUID();db.prepare('INSERT INTO digital_drafts VALUES(?,?,?,?,?,?,?,?,?,?)').run(draft,seller,p,f,meta.category,meta.license,`Testnet edition ${e.edition} / up to 5; artwork reused`,meta.provenance,receiver,0);
 db.prepare('INSERT INTO auctions(id,owner_id,title,description,category,artwork,seller_name,reserve,closes_at,unlock_round,public_key,created_at,payment_address,protocol_version,proof_context,digital_draft_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(e.auction_id,seller,meta.title+' · Testnet #'+e.edition,'Synthetic store fixture only',meta.category,'orbit','VEIL Platform Demo','10000',e.closes_at,1000,'{}',0,receiver,2,'123',draft);bindEdition(db,e.id,seller,0);}
 return{db,meta,p,f,seller,auction};}
test('selected gallery is ten ordered individual works with actual dimensions and no protected paths/hashes',()=>{
 assert.equal(COLLECTION.length,10);assert.deepEqual(COLLECTION.map(f=>f.order),[1,2,3,4,5,6,7,8,9,10]);assert.equal(COLLECTION[0].width,640);assert.equal(COLLECTION[0].height,645);for(const f of COLLECTION){assert.ok(f.width>0&&f.height>0);assert.equal(f.category,'Digital Art');assert.ok(f.previewUrl.endsWith('.webp'));assert.ok(!('sha256'in f));}
});
test('artwork auction default is exactly 35 days and the configured maximum is bounded',()=>{
 assert.equal(windowSeconds(),35*24*60*60);assert.equal(windowSeconds(String(35*24*60*60)),35*24*60*60);assert.throws(()=>windowSeconds(String(35*24*60*60+1)),/35 days/);assert.throws(()=>windowSeconds('59'),/35 days/);
});
test('family registration binds exact private original, normal file ownership and immutable IDs',()=>{const{db,meta,p,f,seller}=setup();try{assert.throws(()=>registerFamily(db,{slug:meta.slug,previewId:p,fileId:f},'outsider',{objects:[{slug:meta.slug,sha256:'ab'.repeat(32)}]}));assert.throws(()=>registerFamily(db,{slug:meta.slug,previewId:p,fileId:f},seller,{objects:[{slug:meta.slug,sha256:'bb'.repeat(32)}]}));assert.throws(()=>db.prepare('UPDATE judging_families SET file_id=?').run(p));}finally{db.close();}});
test('one fixed deadline/current edition, restart reconciliation, verifier-required completion and numbered recurrence',()=>{const{db,meta,auction}=setup();try{
 for(let n=1;n<=5;n++){const e=reserveEdition(db,meta.slug,{now:n*100000,seconds:60});assert.equal(e.edition,n);assert.equal(reserveEdition(db,meta.slug,{now:n*100000+1000,seconds:300}).closes_at,e.closes_at);auction(e);assert.equal(claimProof(db,{now:e.closes_at-1}),null);
  const job=claimProof(db,{now:e.closes_at});assert.ok(job);assert.equal(claimProof(db,{now:e.closes_at}),null);assert.throws(()=>finishProof(db,e.id,job.token,'verified',e.closes_at));assert.throws(()=>finishProof(db,e.id,'00'.repeat(32),'publishing',e.closes_at));
  const recovered=claimProof(db,{now:e.closes_at+1800001});assert.equal(recovered.auctionId,e.auction_id);assert.notEqual(recovered.token,job.token);assert.throws(()=>finishProof(db,e.id,job.token,'publishing',e.closes_at+1800001));
  // Synthetic already-verifier-accepted DB observation, for store transition testing ONLY.
  db.prepare('UPDATE auctions SET result=? WHERE id=?').run(JSON.stringify({status:'zk-verified',amount:'20000',winnerId:randomUUID()}),e.auction_id);finishProof(db,e.id,recovered.token,'verified',e.closes_at+1800001);
  const ended=catalogue(db,e.closes_at+1800002).find(f=>f.slug===meta.slug).current;assert.equal(ended.state,'verified');assert.equal(ended.winningAmount,'20000');assert.equal(ended.closesAt,e.closes_at);
 }
 assert.equal(db.prepare('SELECT COUNT(*) n FROM auctions').get().n,5);assert.throws(()=>reserveEdition(db,meta.slug),/exhausted/);
 const publicData=JSON.stringify(catalogue(db));for(const privateValue of ['private-demo-account',receiver,'ab'.repeat(32),'preview_id','file_id','winnerId','bidder_id'])assert.equal(publicData.includes(privateValue),false);
}finally{db.close();}});
test('failed reveal preserves the edition and all accepted data instead of opening a replacement',()=>{const{db,meta,auction}=setup();try{const e=reserveEdition(db,meta.slug,{now:0,seconds:60});auction(e);const j=claimProof(db,{now:60000});finishProof(db,e.id,j.token,'failed',60000);assert.equal(reserveEdition(db,meta.slug).id,e.id);assert.equal(requestEdition(db,'bidder',meta.slug).state,'failed');assert.equal(claimProof(db,{now:99999999}),null);assert.equal(catalogue(db)[0].current.state,'failed');}finally{db.close();}});
test('wallet activation and lazy edition demand are bounded and idempotent; unknown balance stays null',()=>{const{db,meta}=setup();try{assert.equal(walletStatus(db,'a').balanceZatoshis,null);for(let n=0;n<200;n++)assert.equal(requestWallet(db,'user-'+n).state,'blocked');assert.equal(requestWallet(db,'user-0').state,'blocked');assert.throws(()=>requestWallet(db,'overflow'),/capacity/);assert.equal(db.prepare('SELECT COUNT(*) n FROM judging_wallet_requests').get().n,200);
 assert.equal(requestEdition(db,'a',meta.slug).state,'requested');requestEdition(db,'a',meta.slug);assert.equal(db.prepare('SELECT COUNT(*) n FROM judging_edition_requests').get().n,1);
 assert.equal(walletStatus(db,'user-0').canPay,false);assert.equal(walletStatus(db,'user-0').address,null);
}finally{db.close();}});
test('a lost publication acknowledgement is reconciled from the accepted result after worker failure',()=>{const{db,meta,auction}=setup();try{const e=reserveEdition(db,meta.slug,{now:0,seconds:60});auction(e);const j=claimProof(db,{now:60000});finishProof(db,e.id,j.token,'failed',60000);db.prepare('UPDATE auctions SET result=? WHERE id=?').run(JSON.stringify({status:'zk-verified',amount:'20000'}),e.auction_id);assert.equal(claimProof(db,{now:60001}),null);assert.equal(db.prepare('SELECT state FROM judging_editions WHERE id=?').get(e.id).state,'verified');assert.equal(reserveEdition(db,meta.slug).edition,2);}finally{db.close();}});
test('a full edition can queue a distinct successor without changing its deadline, capacity or accepted log',()=>{const{db,meta,auction}=setup();try{const e=reserveEdition(db,meta.slug,{now:0,seconds:60});auction(e);for(let n=0;n<8;n++)db.prepare('INSERT INTO bids(id,auction_id,bidder_id,commitment,ciphertext,ciphertext_hash,accepted_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),e.auction_id,'fixture-user-'+n,'01'.repeat(32),'synthetic fixture ciphertext','ab'.repeat(32),n);assert.equal(requestEdition(db,'waiting-judge',meta.slug).state,'queued-after-current-edition');assert.equal(db.prepare('SELECT COUNT(*) n FROM judging_edition_requests').get().n,1);assert.equal(reserveEdition(db,meta.slug,{now:1000}).auction_id,e.auction_id);assert.equal(db.prepare('SELECT closes_at FROM auctions WHERE id=?').get(e.auction_id).closes_at,60000);assert.equal(db.prepare('SELECT COUNT(*) n FROM bids WHERE auction_id=?').get(e.auction_id).n,8);}finally{db.close();}});

test('single-auction collection retains its completed edition and rejects a replacement reservation',()=>{
 const {db,meta,auction}=setup();try{
  const e=reserveEdition(db,meta.slug,{now:1000,seconds:3024000,maxEditions:1});auction(e);
  const row=catalogue(db)[0].current;assert.equal(row.sellerName,'VEIL Platform Demo');assert.equal(row.startingBid,'10000');
  assert.equal(reserveEdition(db,meta.slug,{now:2000,maxEditions:1}).closes_at,e.closes_at);
  db.prepare("UPDATE judging_editions SET state='verified' WHERE id=?").run(e.id);
  assert.throws(()=>reserveEdition(db,meta.slug,{maxEditions:1}),/exhausted/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM judging_editions').get().n,1);
 }finally{db.close();}
});
