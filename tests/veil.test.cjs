const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const core = require('../.sites-runtime/test-build/lib/veil/core.js');
const crypt = require('../.sites-runtime/test-build/lib/veil/crypto.js');
const beacon = require('./fixtures/quicknet-1000.json');
// Only transport/hosting adapters are replaced. Production crypto and SQL execute unchanged.
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
for (const file of fs.readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join('drizzle', file), 'utf8'));
const env = { DB: { prepare(sql) { const statement = db.prepare(sql); let values = []; return { bind(...args) { values = args; return this; }, async first() { return statement.get(...values) ?? null; }, async all() { return { results: statement.all(...values) }; }, async run() { return { meta: { changes: statement.run(...values).changes } }; } }; } } };
let requestHeaders = new Headers();
const realLoad = Module._load;
Module._load = function(id, ...args) {
  if (id === 'cloudflare:workers') return { env };
  if (id === '@/app/chatgpt-auth') return require('../.sites-runtime/test-build/app/chatgpt-auth.js');
  if (id === 'next/headers') return { headers: async () => requestHeaders };
  if (id === 'next/navigation') return { redirect: () => { throw new Error('redirect'); } };
  return realLoad.call(this, id, ...args);
};
const server = require('../.sites-runtime/test-build/lib/veil/server.js');
const realFetch = global.fetch, realNow = Date.now;
global.location = { origin: 'https://veil.test' };
let requested = 0, tamperBeacon = false;
global.fetch = async url => {
  assert.equal(String(url), 'https://veil.test/api/drand/public/1000'); requested++;
  return Response.json(tamperBeacon ? { ...beacon, signature: '00'.repeat(48), randomness: createHash('sha256').update(Buffer.alloc(48)).digest('hex') } : beacon);
};
after(() => { global.fetch = realFetch; Date.now = realNow; Module._load = realLoad; db.close(); });
const auctionId = '11111111-1111-4111-8111-111111111111';
const opening = { version: 1, auctionId, bidId: '22222222-2222-4222-8222-222222222222', amount: '250000001', salt: 'ab'.repeat(32) };
let keys, sealed, accepted;

test('ZEC amounts retain all eight decimal places and reject ambiguous inputs', () => {
  assert.equal(core.parseZec('2.50000001'), 250000001n);
  assert.equal(core.formatZec(250000001n), '2.50000001');
  assert.equal(core.parseZec('0.00000001'), 1n);
  for (const bad of ['0', '-1', '1e2', '01', ' 1', '1.000000001', '1000000.00000001', 'Infinity']) assert.throws(() => core.parseZec(bad));
});
test('unlock rounds are strictly after deadlines, including exact round boundaries', () => {
  const boundary = core.roundTimeMs(1000);
  assert.equal(core.unlockRoundFor(boundary), 1001);
  assert.equal(core.unlockRoundFor(boundary - 1), 1000);
  assert.equal(core.unlockRoundFor(boundary + 1), 1001);
});
test('commitments bind amount, nonce, auction and bidder; snapshots bind every accepted entry', async () => {
  const original = await core.commitmentFor(opening);
  for (const changed of [{ ...opening, amount: '250000002' }, { ...opening, salt: 'cd'.repeat(32) }, { ...opening, auctionId: 'another' }, { ...opening, bidId: 'another' }]) assert.notEqual(await core.commitmentFor(changed), original);
  const rows = [1, 2].map(n => ({ id: String(n), sequence: n, commitment: 'ab', ciphertextHash: 'cd', acceptedAt: 0 }));
  assert.equal(await core.snapshotHash(auctionId, rows), await core.snapshotHash(auctionId, [...rows].reverse()));
  assert.notEqual(await core.snapshotHash(auctionId, rows), await core.snapshotHash(auctionId, rows.slice(1)));
});
test('highest eligible amount wins; first acceptance wins a tie; malformed bids stop tally', () => {
  const bids = [3, 1, 2].map(sequence => ({ ...opening, sequence }));
  assert.equal(core.chooseWinner(bids, '100000000').sequence, 1);
  assert.equal(core.chooseWinner(bids, '300000000'), null);
  assert.throws(() => core.chooseWinner([{ ...opening, amount: '-1', sequence: 1 }], '1'));
});
test('seller encryption rejects a wrong key and a different auction or bidder', async () => {
  keys = await crypt.generateAuctionKeys();
  const encrypted = await crypt.encryptForSeller(opening, keys.publicKey);
  assert.deepEqual(await crypt.decryptForSeller(encrypted, keys.privateKey, auctionId, opening.bidId), opening);
  const other = await crypt.generateAuctionKeys();
  await assert.rejects(crypt.decryptForSeller(encrypted, other.privateKey, auctionId, opening.bidId));
  await assert.rejects(crypt.decryptForSeller(encrypted, keys.privateKey, 'another', opening.bidId));
  await assert.rejects(crypt.decryptForSeller(encrypted, keys.privateKey, auctionId, 'another'));
});
test('real tlock envelope requires its pinned chain, exact round and a single recipient', async () => {
  sealed = await crypt.sealBid(auctionId, keys.publicKey, 1000, opening.amount);
  core.validateTimelockArmor(sealed.ciphertext, 1000);
  assert.throws(() => core.validateTimelockArmor(sealed.ciphertext, 1001));
  const decoded = Buffer.from(sealed.ciphertext.split('\n').slice(1, -2).join(''), 'base64').toString('binary');
  const armor = text => `-----BEGIN AGE ENCRYPTED FILE-----\n${Buffer.from(text, 'binary').toString('base64')}\n-----END AGE ENCRYPTED FILE-----\n`;
  assert.throws(() => core.validateTimelockArmor(armor(decoded.replace(core.QUICKNET.hash, '00'.repeat(32))), 1000));
  assert.throws(() => core.validateTimelockArmor(armor(decoded.replace('\n--- ', '\n-> X25519 alternate\nabc\n--- ')), 1000));
});
test('timelock refuses early opening, then verifies a real drand signature and rejects tampering', async () => {
  const envelope = { ...sealed, sequence: 1, acceptedAt: 0 };
  Date.now = () => core.roundTimeMs(1000) - 1;
  await assert.rejects(crypt.openBid(envelope, keys.privateKey, auctionId, 1000), /too early/);
  assert.equal(requested, 0);
  Date.now = realNow;
  assert.equal((await crypt.openBid(envelope, keys.privateKey, auctionId, 1000)).amount, opening.amount);
  await assert.rejects(crypt.openBid({ ...envelope, ciphertextHash: '00'.repeat(32) }, keys.privateKey, auctionId, 1000), /changed/);
  await assert.rejects(crypt.openBid({ ...envelope, commitment: '00'.repeat(32) }, keys.privateKey, auctionId, 1000), /commitment|receipt/);
  tamperBeacon = true;
  await assert.rejects(crypt.openBid(envelope, keys.privateKey, auctionId, 1000));
  tamperBeacon = false;
});
test('server requires signed-in identity and rejects cross-site writes', async () => {
  await assert.rejects(server.actor(new Request('https://veil.test/api/auctions')), { status: 401 });
  requestHeaders = new Headers({ 'oai-authenticated-user-id': 'test-user', 'oai-authenticated-user-email': 'test@example.invalid' });
  assert.equal(await server.actor(new Request('https://veil.test/api/auctions')), 'test-user');
  await assert.rejects(server.actor(new Request('https://veil.test/api/auctions', { headers: { origin: 'https://other.test' } }), true), { status: 403 });
});
test('persisted auction accepts a sealed bid, preserves its bytes and hides identity/ciphertext in the public log', async () => {
  Date.now = () => core.roundTimeMs(1000) - 120000;
  const auction = await server.createAuction({ id: auctionId, title: 'Test auction', description: 'A fictional test auction object.', sellerName: 'Studio', category: 'Art', artwork: 'orbit', reserve: '100000000', closesAt: core.roundTimeMs(1000) - 1, publicKey: keys.publicKey }, 'seller');
  assert.equal(auction.unlockRound, 1000);
  assert.equal(auction.protocolVersion,2);
  // Preserve regression coverage for already deployed v1 auctions.
  db.prepare('UPDATE auctions SET protocol_version=1,proof_context=NULL WHERE id=?').run(auctionId);
  await assert.rejects(server.acceptBid(auctionId, sealed, 'seller'), { status: 403 });
  accepted = await server.acceptBid(auctionId, sealed, 'bidder');
  assert.equal(accepted.ciphertextHash, sealed.ciphertextHash);
  const detail = await server.details(auctionId, 'bidder');
  assert.equal(detail.myBid, sealed.id);
  assert.equal(detail.bids.length, 1);
  const publicJSON = JSON.stringify(detail);
  for (const field of ['owner_id', 'bidder_id', 'privateKey', 'ciphertext"', 'email', 'salt"']) assert.ok(!publicJSON.includes(field), field);
  await assert.rejects(server.sellerEnvelopes(auctionId, 'seller'), { status: 409 });
  await assert.rejects(server.sellerEnvelopes(auctionId, 'bidder'), { status: 403 });
  await assert.rejects(server.acceptBid(auctionId, { ...sealed, id: crypto.randomUUID() }, 'bidder'), { status: 409 });
});
test('closed auction rejects late bids; owner-only result must match accepted amount and full snapshot', async () => {
  Date.now = () => core.roundTimeMs(1000) + 100;
  await assert.rejects(server.acceptBid(auctionId, { ...sealed, id: crypto.randomUUID() }, 'late-bidder'), { status: 409 });
  const envelopes = await server.sellerEnvelopes(auctionId, 'seller');
  assert.equal(envelopes[0].ciphertext, sealed.ciphertext);
  const opened = await crypt.openBid(envelopes[0], keys.privateKey, auctionId, 1000);
  const detail = await server.details(auctionId, 'seller');
  const declaration = { winnerId: opened.bidId, amount: opened.amount, salt: opened.salt, openedCount: 1, snapshotHash: detail.snapshotHash };
  await assert.rejects(server.declareResult(auctionId, declaration, 'bidder'), { status: 403 });
  await assert.rejects(server.declareResult(auctionId, { ...declaration, snapshotHash: '00'.repeat(32) }, 'seller'), { status: 409 });
  await assert.rejects(server.declareResult(auctionId, { ...declaration, amount: '250000002' }, 'seller'), { status: 400 });
  const result = await server.declareResult(auctionId, declaration, 'seller');
  assert.equal(result.status, 'seller-declared');
  assert.equal(result.amount, opening.amount);
  await assert.rejects(server.declareResult(auctionId, declaration, 'seller'), { status: 409 });
  Date.now = realNow;
});
test('request body limits and content-type validation reject malformed submissions', async () => {
  await assert.rejects(server.body(new Request('https://veil.test', { method: 'POST', body: '{}' })), { status: 415 });
  await assert.rejects(server.body(new Request('https://veil.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"v":"' + 'x'.repeat(18000) + '"}' })), { status: 413 });
  await assert.rejects(server.body(new Request('https://veil.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]' })), { status: 400 });
});
// The fixture below encodes a synthetic 43-byte receiver with the independent BIP173 encoder.
// It is checksum-valid test data, not a wallet receiving address; never pay it.
function bech32Fixture() {
  const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l', prefix = 'ztestsapling';
  const bytes = new Uint8Array(43).fill(0x13), words = []; let acc = 0, bits = 0;
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; words.push((acc >>> bits) & 31); } }
  if (bits) words.push((acc << (5 - bits)) & 31);
  const input = [...prefix].map(c => c.charCodeAt(0) >>> 5).concat([0], [...prefix].map(c => c.charCodeAt(0) & 31), words, [0,0,0,0,0,0]);
  let checksum = 1;
  for (const value of input) { const top = checksum >>> 25; checksum = ((checksum & 0x1ffffff) << 5) ^ value; [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3].forEach((g, i) => { if ((top >>> i) & 1) checksum ^= g; }); }
  checksum ^= 1;
  return prefix + '1' + words.concat(Array.from({ length: 6 }, (_, i) => (checksum >>> (5 * (5 - i))) & 31)).map(x => alphabet[x]).join('');
}
test('ZIP321 request preserves amount and memo; Sapling checksum and padding validation accept the full receiver', () => {
  const address = bech32Fixture();
  assert.ok(core.isSaplingTestnet(address));
  assert.ok(!core.isSaplingTestnet(address.slice(0, -1) + (address.endsWith('q') ? 'p' : 'q')));
  assert.ok(!core.isSaplingTestnet(address.toUpperCase()));
  assert.ok(!core.isSaplingTestnet(address.replace('ztestsapling', 'zs')));
  const uri = core.paymentUri(address, '250000001', auctionId, opening.bidId), query = new URLSearchParams(uri.split('?')[1]);
  assert.equal(query.get('amount'), '2.50000001');
  assert.equal(Buffer.from(query.get('memo'), 'base64url').toString(), `VEIL:${auctionId}:${opening.bidId}`);
});

test('v2 proof binds complete accepted log, winner, reserve and context; malformed proofs cannot publish',async()=>{
  const {proofWitness,proofPublicSignals}=require('../.sites-runtime/test-build/lib/veil/zk/protocol.js');
  const {verifyHighestBid}=require('../.sites-runtime/test-build/lib/veil/zk/verify.js');
  const {plonk,wtns}=await import('snarkjs');
  Date.now=()=>core.roundTimeMs(1000)-120000;
  const id=crypto.randomUUID();
  const auction=await server.createAuction({id,title:'Proof auction',description:'A proof-enabled fictional auction.',sellerName:'Studio',category:'Art',artwork:'orbit',reserve:'100',closesAt:core.roundTimeMs(1000)-1,publicKey:keys.publicKey},'seller');
  const openings=[],bids=[];
  for(const [i,amount] of ['180','250','250'].entries()){
    const envelope=await crypt.sealBid(id,keys.publicKey,1000,amount,auction.proofContext);
    openings.push(envelope.opening);bids.push(await server.acceptBid(id,envelope,'proof-bidder-'+i));
  }
  const winner=core.chooseWinner(openings.map((o,i)=>({...o,sequence:bids[i].sequence})),auction.reserve);
  assert.equal(winner.bidId,openings[1].bidId);
  const witness=await proofWitness(auction,bids,openings,winner.bidId,winner.amount);
  const proof=await plonk.fullProve(witness,'.sites-runtime/zk-build/auction_js/auction.wasm','.sites-runtime/zk-build/auction.zkey',undefined,undefined,{singleThread:true});
  const bundle={circuitId:core.PROOF_CIRCUIT,...proof};
  const expected=proofPublicSignals(auction,bids,winner.bidId,winner.amount);
  assert.deepEqual(await verifyHighestBid(bundle,expected),bundle);
  for(const changes of [{winnerIndex:'3'},{winningAmount:'249'},{reserve:'251'},{amounts:['180','251','250','0','0','0','0','0']},{count:'2'},{context:'999'}]){
    const bad={...witness,...changes};
    await assert.rejects(plonk.fullProve(bad,'.sites-runtime/zk-build/auction_js/auction.wasm','.sites-runtime/zk-build/auction.zkey',undefined,undefined,{singleThread:true}));
  }
  await assert.rejects(verifyHighestBid(bundle,proofPublicSignals(auction,bids.slice(1),winner.bidId,winner.amount)),/inputs/);
  const mutated=structuredClone(bundle);mutated.proof.eval_a=String((BigInt(mutated.proof.eval_a)+1n)%core.SNARK_FIELD);
  await assert.rejects(verifyHighestBid(mutated,expected),/invalid/);
  const point=structuredClone(bundle);point.proof.A=['0','0','1'];await assert.rejects(verifyHighestBid(point,expected),/invalid/);
  Date.now=()=>core.roundTimeMs(1000)+100;
  const detail=await server.details(id,'seller'),declaration={winnerId:winner.bidId,amount:winner.amount,salt:winner.salt,openedCount:3,snapshotHash:detail.snapshotHash,proof:bundle};
  await assert.rejects(server.declareResult(id,{...declaration,proof:undefined},'seller'),/required/);
  await assert.rejects(server.declareResult(id,{...declaration,proof:mutated},'seller'),/invalid/);
  const {publishOnce,reconcilePublication}=require('../.sites-runtime/test-build/lib/veil/publication.js');
  const attempt={auction:detail.auction,bids:detail.bids,payload:declaration};let writes=0,result;
  const recovered=await publishOnce(attempt,async()=>{writes++;result=await server.declareResult(id,declaration,'seller');throw Error('Server committed, response lost');},()=>server.details(id,'seller'));
  assert.equal(writes,1);assert.equal(recovered.status,'matched');assert.equal(result.status,'zk-verified');
  assert.equal((await reconcilePublication(attempt,async()=>({...await server.details(id,'seller'),snapshotHash:'00'.repeat(32)}))).status,'conflict');
  assert.equal((await reconcilePublication(attempt,async()=>{throw Error('Network unavailable');})).status,'unknown');
  const unpublished={...await server.details(id,'seller')};unpublished.auction={...unpublished.auction,result:null};
  assert.equal((await reconcilePublication(attempt,async()=>unpublished)).status,'unknown');
  assert.equal(JSON.stringify(result).includes(openings[0].salt),false);
  assert.equal(JSON.stringify(result).includes(openings[2].salt),false);
  const empty=await proofWitness(auction,[],[],null,null);
  const emptyProof=await plonk.fullProve(empty,'.sites-runtime/zk-build/auction_js/auction.wasm','.sites-runtime/zk-build/auction.zkey',undefined,undefined,{singleThread:true});
  await verifyHighestBid({circuitId:core.PROOF_CIRCUIT,...emptyProof},proofPublicSignals(auction,[],null,null));
  await wtns.calculate({...witness,reserve:'251',winnerIndex:'0',winningAmount:'0'},'.sites-runtime/zk-build/auction_js/auction.wasm',{type:'mem'});
  Date.now=realNow;
});

test('payment reports require trusted signatures, exact invoice, sufficient confirmations and freshness',async()=>{
 const {validatePaymentReport,reportMessage}=require('../.sites-runtime/test-build/lib/veil/payment.js');
 const {generateKeyPairSync,sign}=require('node:crypto');
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const pk=publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex'),now=realNow();
 const invoice={version:1,network:'testnet',invoiceId:'aa'.repeat(32),auctionId, bidId:opening.bidId,address:'test-address',amount:'250',memo:'invoice memo'};
 const report={version:1,invoiceId:invoice.invoiceId,network:'testnet',txid:'bb'.repeat(32),output:0,pool:'sapling',address:invoice.address,amount:invoice.amount,memo:invoice.memo,status:'confirmed',blockHash:'cc'.repeat(32),blockHeight:98,tipHeight:100,confirmations:3,observedAt:now,expiresAt:now+300000};
 const signed=r=>({report:r,signature:sign(null,reportMessage(r),privateKey).toString('hex')});
 await validatePaymentReport(signed(report),invoice,pk,now);
 for(const changes of [{invoiceId:'dd'.repeat(32)},{network:'mainnet'},{address:'other'},{amount:'251'},{memo:'other'},{confirmations:2},{blockHeight:99},{observedAt:now-300001},{observedAt:now+30001},{expiresAt:now},{expiresAt:now+300001}])await assert.rejects(validatePaymentReport(signed({...report,...changes}),invoice,pk,now));
 await assert.rejects(validatePaymentReport({...signed(report),signature:'00'.repeat(64)},invoice,pk,now));
 await assert.rejects(validatePaymentReport(signed(report),invoice,'',now));
 await validatePaymentReport(signed({...report,status:'not-confirmed',blockHash:null,blockHeight:null,confirmations:0}),invoice,pk,now);
});

test('read-only scanner checks wallet sync and incoming note, and downgrades reorged output',async()=>{
 const {scanInvoice}=await import('../scanner/scan.mjs');
 const invoice={version:1,network:'testnet',invoiceId:'aa'.repeat(32),auctionId,bidId:opening.bidId,address:require('./fixtures/synthetic-receiver.json').address,amount:'250',memo:`VEIL:${auctionId}:${opening.bidId}`};
 const txid='bb'.repeat(32),block='cc'.repeat(32),tip='dd'.repeat(32);
 const state={locked:false,node_tip:{height:100,blockhash:tip},wallet_tip:{height:100,blockhash:tip},fully_synced_height:100};
 const output={pool:'sapling',output:0,address:invoice.address,valueZat:250,memo:Buffer.from(invoice.memo).toString('hex').padEnd(1024,'0'),outgoing:false,walletInternal:false};
 let note={...output},wallet={...state},active=block,conf=3;
 const walletRpc=async method=>method==='getwalletstatus'?wallet:{txid,status:'mined',confirmations:conf,blockhash:block,outputs:[note]};
 const chainRpc=async method=>method==='getblockchaininfo'?{chain:'test',blocks:100,headers:100,estimatedheight:100,verificationprogress:1,bestblockhash:tip}:method==='getblockheader'?{hash:tip,height:100,confirmations:1,time:Math.floor(Date.now()/1000)}:method==='getblock'?{hash:block,confirmations:3,height:98,tx:[txid]}:active;
 assert.equal((await scanInvoice(invoice,txid,0,walletRpc,chainRpc)).status,'confirmed');
 for(const change of [{address:'other'},{valueZat:249},{memo:'00'.repeat(512)},{outgoing:true},{walletInternal:true},{pool:'transparent'}]){note={...output,...change};await assert.rejects(scanInvoice(invoice,txid,0,walletRpc,chainRpc),/Output/);}note={...output};
 wallet={...state,locked:true};await assert.rejects(scanInvoice(invoice,txid,0,walletRpc,chainRpc),/synchronized/);wallet={...state,fully_synced_height:99};await assert.rejects(scanInvoice(invoice,txid,0,walletRpc,chainRpc),/synchronized/);wallet=state;
 active='ee'.repeat(32);assert.equal((await scanInvoice(invoice,txid,0,walletRpc,chainRpc)).status,'not-confirmed');active=block;conf=2;assert.equal((await scanInvoice(invoice,txid,0,walletRpc,chainRpc)).status,'not-confirmed');
});

test('persisted payment status is private, rejects replay/reused outputs and expires or revokes confirmations',async()=>{
 const {paymentInvoice,reportMessage}=require('../.sites-runtime/test-build/lib/veil/payment.js');
 const {generateKeyPairSync,sign}=require('node:crypto');
 const pair=generateKeyPairSync('ed25519');env.VEIL_SCANNER_PUBLIC_KEY=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');
 db.prepare('UPDATE auctions SET payment_address=? WHERE id=?').run(bech32Fixture(),auctionId);
 const a=(await server.details(auctionId,'seller')).auction,invoice=await paymentInvoice(a),now=realNow();Date.now=()=>now;
 await assert.rejects(server.paymentStatus(auctionId,'outsider'),{status:403});
 const report={version:1,invoiceId:invoice.invoiceId,network:'testnet',txid:'bb'.repeat(32),output:0,pool:'sapling',address:invoice.address,amount:invoice.amount,memo:invoice.memo,status:'confirmed',blockHash:'cc'.repeat(32),blockHeight:98,tipHeight:100,confirmations:3,observedAt:now,expiresAt:now+300000};
 const signed=r=>({report:r,signature:sign(null,reportMessage(r),pair.privateKey).toString('hex')});
 assert.equal((await server.submitPaymentReport(auctionId,signed(report),'seller')).status,'scanner-confirmed');
 assert.equal((await server.paymentStatus(auctionId,'bidder')).status,'scanner-confirmed');
 const trusted=env.VEIL_SCANNER_PUBLIC_KEY;
 const rotation=generateKeyPairSync('ed25519');env.VEIL_SCANNER_PUBLIC_KEY=rotation.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');
 assert.equal((await server.paymentStatus(auctionId,'seller')).status,'needs-refresh');
 await assert.rejects(server.submitPaymentReport(auctionId,signed({...report,observedAt:now+1}),'seller'),/signed/);
 const rotatedReport={...report,observedAt:now+1};
 assert.equal((await server.submitPaymentReport(auctionId,{report:rotatedReport,signature:sign(null,reportMessage(rotatedReport),rotation.privateKey).toString('hex')},'bidder')).status,'scanner-confirmed');
 delete env.VEIL_SCANNER_PUBLIC_KEY;assert.equal((await server.paymentStatus(auctionId,'seller')).status,'needs-refresh');
 env.VEIL_SCANNER_PUBLIC_KEY=trusted;
 await assert.rejects(server.submitPaymentReport(auctionId,signed(report),'seller'),{status:409});
 Date.now=()=>now+300001;assert.equal((await server.paymentStatus(auctionId,'bidder')).status,'needs-refresh');
 const revoked={...report,observedAt:now+300001,expiresAt:now+600001,status:'not-confirmed',blockHash:null,blockHeight:null,confirmations:0};
 assert.equal((await server.submitPaymentReport(auctionId,signed(revoked),'seller')).status,'not-confirmed');
 // A second invoice cannot claim the same note even if the scanner signs it.
 const otherId=crypto.randomUUID();
 db.prepare('INSERT INTO auctions (id,owner_id,title,description,category,artwork,seller_name,reserve,closes_at,unlock_round,public_key,created_at,payment_address,result,protocol_version,proof_context,payment_window_hours) SELECT ?,owner_id,title,description,category,artwork,seller_name,reserve,closes_at,unlock_round,public_key,created_at,payment_address,result,protocol_version,proof_context,payment_window_hours FROM auctions WHERE id=?').run(otherId,auctionId);
 const otherInvoice=await paymentInvoice((await server.details(otherId,'seller')).auction);
 await assert.rejects(server.submitPaymentReport(otherId,signed({...revoked,invoiceId:otherInvoice.invoiceId,memo:otherInvoice.memo}),'seller'),{status:409});
 delete env.VEIL_SCANNER_PUBLIC_KEY;assert.equal((await server.paymentStatus(auctionId,'seller')).configured,false);Date.now=realNow;
});


test('payment follow-up preserves the winner and distinguishes overdue policy from scanner evidence',async()=>{
 db.prepare('UPDATE auctions SET payment_window_hours=NULL WHERE id=?').run(auctionId);
 const initial=await server.details(auctionId,'seller'),before=JSON.stringify(initial.auction.result);
 assert.equal((await server.paymentStatus(auctionId,'seller')).workflow.dueAt,null);
 db.prepare('UPDATE auctions SET payment_window_hours=24 WHERE id=?').run(auctionId);
 const declared=initial.auction.result.declaredAt;Date.now=()=>declared+1000;
 const pending=await server.paymentStatus(auctionId,'seller');assert.equal(pending.workflow.dueAt,declared+86400000);assert.equal(pending.workflow.overdue,false);
 await assert.rejects(server.submitPaymentFollowup(auctionId,{action:'reported-sent'},'seller'),{status:403});
 await assert.rejects(server.submitPaymentFollowup(auctionId,{action:'reported-sent'},'outsider'),{status:403});
 await assert.rejects(server.submitPaymentFollowup(auctionId,{action:'requested-discussion'},'bidder'),{status:409});
 const reported=await server.submitPaymentFollowup(auctionId,{action:'reported-sent'},'bidder');
 assert.notEqual(reported.status,'scanner-confirmed');assert.equal(reported.workflow.actions[0].action,'reported-sent');
 Date.now=()=>declared+86400000;
 const overdue=await server.submitPaymentFollowup(auctionId,{action:'requested-discussion'},'seller');assert.equal(overdue.workflow.overdue,true);
 assert.equal(overdue.workflow.actions.length,2);assert.equal(JSON.stringify((await server.details(auctionId,'seller')).auction.result),before);
 await assert.rejects(server.submitPaymentFollowup(auctionId,{action:'reassign-winner'},'seller'),{status:400});
 Date.now=realNow;
});


test('legacy result reconciliation never relabels an unproved declaration',async()=>{
 const {reconcilePublication}=require('../.sites-runtime/test-build/lib/veil/publication.js');
 const detail=await server.details(auctionId,'seller'),r=detail.auction.result;
 const attempt={auction:detail.auction,bids:detail.bids,payload:{winnerId:r.winnerId,amount:r.amount,salt:r.salt,snapshotHash:r.snapshotHash,openedCount:detail.bids.length}};
 assert.equal((await reconcilePublication(attempt,async()=>detail)).status,'matched');
 const relabelled={...detail,auction:{...detail.auction,result:{...r,status:'zk-verified'}}};
 assert.equal((await reconcilePublication(attempt,async()=>relabelled)).status,'conflict');
 for(const changes of [{publicKey:{...detail.auction.publicKey,e:'Aw'}},{publicKey:{...detail.auction.publicKey,key_ops:['verify']}},{paymentWindowHours:48}]){
  const changed={...detail,auction:{...detail.auction,...changes}};assert.equal((await reconcilePublication(attempt,async()=>changed)).status,'conflict');
 }
});

require('./payment-queue.cjs')({test,assert,db,env,server,core,auctionId,realNow});

