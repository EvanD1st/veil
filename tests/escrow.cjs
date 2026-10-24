// SOURCE-DERIVED SYNTHETIC auction/deposit fixtures. No actual wallet or transfer evidence.
module.exports=({test,assert,db,env,server,core,auctionId,realNow})=>{
 const escrow=require('../.sites-runtime/test-build/lib/veil/escrow.js');
 const {generateKeyPairSync,sign}=require('node:crypto');const {reportMessage}=require('../.sites-runtime/test-build/lib/veil/payment.js');
 const receiver=require('./fixtures/synthetic-receiver.json').address;
 function lot(){const row={...db.prepare('SELECT * FROM auctions WHERE id=?').get(auctionId),id:crypto.randomUUID(),owner_id:'escrow-seller',payment_mode:'escrow-testnet',fulfillment_terms:JSON.stringify({itemType:'digital',deliveryMethod:'digital-download',deliveryDays:7,eligibleLocations:'Worldwide',shippingTerms:'Included'}),escrow_payout_address:receiver,escrow_fee_cap:'10000',payment_address:receiver,payment_window_hours:24};const bid=crypto.randomUUID();row.result=JSON.stringify({...JSON.parse(row.result),winnerId:bid,amount:'120000000',status:'zk-verified',declaredAt:realNow()});const keys=Object.keys(row);db.prepare('INSERT INTO auctions('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...Object.values(row));db.prepare('INSERT INTO bids(id,auction_id,bidder_id,commitment,ciphertext,ciphertext_hash,accepted_at) VALUES(?,?,?,?,?,?,?)').run(bid,row.id,'escrow-buyer','ab'.repeat(32),'synthetic','cd'.repeat(32),realNow());return row.id;}
 async function action(id,who,action,extra={}){const state=await escrow.escrowStatus(id,who);return escrow.escrowAction(id,{revision:state.revision,action,...extra},who);}
 test('escrow creation flag, immutable terms and no-winner gate preserve direct mode',async()=>{
  delete env.VEIL_EXPERIMENTAL_TESTNET_ESCROW;assert.equal(escrow.creationPolicy({},receiver).mode,'direct');assert.throws(()=>escrow.creationPolicy({paymentMode:'escrow-testnet'},receiver),/disabled/);
  env.VEIL_EXPERIMENTAL_TESTNET_ESCROW='1';env.VEIL_ESCROW_DEPOSIT_ADDRESS=receiver;const input={paymentMode:'escrow-testnet',reserve:'120000000',fulfillmentTerms:{itemType:'physical',deliveryMethod:'shipping-included',deliveryDays:7,eligibleLocations:'Local',shippingTerms:'All shipping included'}};
  assert.equal(escrow.creationPolicy(input,receiver).address,receiver);assert.throws(()=>escrow.creationPolicy({...input,fulfillmentTerms:{...input.fulfillmentTerms,deliveryMethod:'shipping-extra'}},receiver));
  const id=lot();assert.throws(()=>db.prepare("UPDATE auctions SET payment_address='changed' WHERE id=?").run(id),/Immutable/);
  const noWinner=lot();db.prepare('UPDATE auctions SET result=? WHERE id=?').run(JSON.stringify({winnerId:null,amount:null,status:'zk-verified'}),noWinner);assert.equal(await escrow.ensureEscrowOrder(noWinner),null);
  delete env.VEIL_EXPERIMENTAL_TESTNET_ESCROW;delete env.VEIL_ESCROW_DEPOSIT_ADDRESS;
 });
 test('synthetic escrow: private fulfillment, strict signed deposits, expiry, dispute races and separate operator decisions',async()=>{
  const id=lot(),pair=generateKeyPairSync('ed25519');env.VEIL_SCANNER_PUBLIC_KEY=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');env.VEIL_ESCROW_OPERATOR_IDS='escrow-operator';
  await assert.rejects(escrow.escrowStatus(id,'outsider'),{status:403});await assert.rejects(escrow.escrowStatus(id,'escrow-operator'),{status:403});
  let state=await escrow.escrowStatus(id,'escrow-buyer');assert.equal(state.funding.state,'unverified');assert.equal(state.refundDestinationFrozen,false);const now=realNow();
  const r={version:1,invoiceId:state.invoice.invoiceId,network:'testnet',txid:'f1'.repeat(32),output:12,pool:'sapling',address:receiver,amount:'120000000',memo:state.invoice.memo,status:'confirmed',blockHash:'a1'.repeat(32),blockHeight:98,tipHeight:100,confirmations:3,observedAt:now,expiresAt:now+300000};const signed=r=>({report:r,signature:sign(null,reportMessage(r),pair.privateKey).toString('hex')});
  for(const change of [{network:'mainnet'},{address:'wrong'},{memo:'wrong'},{amount:'1'},{output:-1},{confirmations:2}])await assert.rejects(server.submitPaymentReport(id,signed({...r,...change}),'escrow-buyer'));
  await server.submitPaymentReport(id,signed(r),'escrow-buyer');state=await escrow.escrowStatus(id,'escrow-buyer');assert.equal(state.funding.state,'current');assert.equal(db.prepare('SELECT COUNT(*) n FROM escrow_deposits WHERE order_id=?').get(id).n,1);
  await assert.rejects(server.submitPaymentReport(id,signed(r),'escrow-buyer'),/newer/);
  await action(id,'escrow-buyer','delivery-details',{details:'Synthetic delivery detail'});await action(id,'escrow-buyer','refund-destination',{address:receiver});
  await assert.rejects(action(id,'escrow-seller','release',{confirm:'I confirm receipt and authorize payment to the seller'}),{status:403});
  await assert.rejects(action(id,'escrow-buyer','release',{confirm:'I confirm receipt and authorize payment to the seller'}),{status:403});
  await assert.rejects(action(id,'escrow-seller','fulfilled',{tracking:'javascript://bad'}));await action(id,'escrow-seller','fulfilled',{tracking:'https://example.invalid/delivery'});
  const snapshot=await escrow.escrowStatus(id,'escrow-buyer');const concurrent=await Promise.allSettled([escrow.escrowAction(id,{revision:snapshot.revision,action:'release',confirm:'I confirm receipt and authorize payment to the seller'},'escrow-buyer'),escrow.escrowAction(id,{revision:snapshot.revision,action:'dispute',reason:'Synthetic missing delivery'},'escrow-buyer')]);assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  if((await escrow.escrowStatus(id,'escrow-buyer')).dispute!=='open')await action(id,'escrow-buyer','dispute',{reason:'Synthetic missing delivery'});
  assert.equal(db.prepare("SELECT count(*) n FROM escrow_intents WHERE order_id=? AND state<>'cancelled'").get(id).n,0);
  // Dispute cancellation must keep the refund control locked, even without an active intent.
  assert.equal((await escrow.escrowStatus(id,'escrow-buyer')).refundDestinationFrozen,true);
  await assert.rejects(action(id,'escrow-buyer','refund-destination',{address:receiver}),{status:403});
  await assert.rejects(action(id,'escrow-seller','operator-release',{reason:'Unprivileged operator attempt'}),{status:403});
  await action(id,'escrow-operator','operator-refund',{reason:'Synthetic operator full refund decision'});
  const intent=db.prepare("SELECT * FROM escrow_intents WHERE order_id=? AND state<>'cancelled'").get(id);assert.equal(intent.kind,'refund');assert.equal(intent.state,'requested');assert.equal(intent.destination,receiver);
  assert.throws(()=>db.prepare('DELETE FROM escrow_deposits WHERE order_id=?').run(id),/Permanent/);assert.throws(()=>db.prepare('UPDATE escrow_events SET reason=? WHERE order_id=?').run('tamper',id),/Append-only/);
  Date.now=()=>now+300001;assert.equal((await escrow.escrowStatus(id,'escrow-buyer')).funding.state,'uncertain');assert.equal(db.prepare('SELECT COUNT(*) n FROM escrow_deposits WHERE order_id=?').get(id).n,1);Date.now=realNow;
  const revoked={...r,status:'not-confirmed',blockHash:null,blockHeight:null,confirmations:0,observedAt:now+1,expiresAt:now+300000};await server.submitPaymentReport(id,signed(revoked),'escrow-buyer');assert.equal((await escrow.escrowStatus(id,'escrow-buyer')).funding.state,'uncertain');
  const other=lot();await escrow.ensureEscrowOrder(other);await assert.rejects(server.submitPaymentReport(other,signed({...r,invoiceId:(await escrow.escrowStatus(other,'escrow-buyer')).invoice.invoiceId,memo:(await escrow.escrowStatus(other,'escrow-buyer')).invoice.memo}),'escrow-buyer'),/already belongs/);
  delete env.VEIL_ESCROW_OPERATOR_IDS;
 });
 test('delivery deadline is anchored to publication rather than first order access',async()=>{
  const id=lot(),published=realNow()-2*86400000,row=db.prepare('SELECT result FROM auctions WHERE id=?').get(id);
  db.prepare('UPDATE auctions SET result=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.result),declaredAt:published}),id);
  const state=await escrow.escrowStatus(id,'escrow-buyer');assert.equal(state.deliveryDueAt,published+7*86400000);
  assert.equal((await escrow.escrowStatus(id,'escrow-seller')).deliveryDueAt,state.deliveryDueAt);
  Date.now=()=>published+8*86400000;
  try{assert.equal((await escrow.escrowStatus(id,'escrow-buyer')).overdue,true);}finally{Date.now=realNow;}
  const overdueId=lot(),overdueRow=db.prepare('SELECT result FROM auctions WHERE id=?').get(overdueId);
  db.prepare('UPDATE auctions SET result=? WHERE id=?').run(JSON.stringify({...JSON.parse(overdueRow.result),declaredAt:realNow()-8*86400000}),overdueId);
  assert.equal((await escrow.escrowStatus(overdueId,'escrow-buyer')).overdue,true);
  const invalidId=lot(),invalidRow=db.prepare('SELECT result FROM auctions WHERE id=?').get(invalidId);
  db.prepare('UPDATE auctions SET result=? WHERE id=?').run(JSON.stringify({...JSON.parse(invalidRow.result),declaredAt:null}),invalidId);
  await assert.rejects(escrow.ensureEscrowOrder(invalidId),{status:409});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM escrow_orders WHERE id=?').get(invalidId).n,0);
 });
 test('late exact deposits remain durable but held for explicit operator review',async()=>{
  const id=lot(),now=realNow(),row=db.prepare('SELECT result FROM auctions WHERE id=?').get(id);db.prepare('UPDATE auctions SET result=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.result),declaredAt:now-25*3600000}),id);
  const pair=generateKeyPairSync('ed25519');env.VEIL_SCANNER_PUBLIC_KEY=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');const state=await escrow.escrowStatus(id,'escrow-buyer');
  const r={version:1,invoiceId:state.invoice.invoiceId,network:'testnet',txid:'f3'.repeat(32),output:3,pool:'sapling',address:receiver,amount:'120000000',memo:state.invoice.memo,status:'confirmed',blockHash:'a3'.repeat(32),blockHeight:98,tipHeight:100,confirmations:3,observedAt:now,expiresAt:now+300000};await server.submitPaymentReport(id,{report:r,signature:sign(null,reportMessage(r),pair.privateKey).toString('hex')},'escrow-buyer');const current=await escrow.escrowStatus(id,'escrow-buyer');assert.equal(current.funding.state,'uncertain');assert.equal(current.funding.late,true);assert.equal(db.prepare("SELECT COUNT(*) n FROM escrow_exceptions WHERE order_id=? AND category='late'").get(id).n,1);
 });

};
