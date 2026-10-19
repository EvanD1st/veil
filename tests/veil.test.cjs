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
