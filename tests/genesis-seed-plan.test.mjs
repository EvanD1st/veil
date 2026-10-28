import test from 'node:test';
import assert from 'node:assert/strict';
import collection from '../judging/collection.json' with {type:'json'};
import {familiesToSeed,ownerSeedConfig,verifyExistingOwnerAuctions,DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,verifyCollectionOriginals,verifyOwnerReceiver,seedCollection,verifyCollectionRecovery} from '../judging/demo-client.mjs';

test('seed-all selects every missing uploaded artwork and skips any already-created auction',()=>{
 const existing=[{slug:collection[2].slug,current:{auctionId:'existing-auction',state:'open'}}];
 const plan=familiesToSeed(existing);
 assert.equal(plan.length,collection.length-1);
 assert.ok(!plan.includes(collection[2].slug));
 assert.deepEqual(familiesToSeed(collection.map(f=>({slug:f.slug,current:{auctionId:'auction-'+f.slug,state:'verified'}}))),[]);
});

test('seed-all retries a retained preparation with no auction id instead of manufacturing a second listing',()=>{
 const partial=[{slug:collection[0].slug,current:{auctionId:null,state:'preparing'}}];
 const plan=familiesToSeed(partial);
 assert.ok(plan.includes(collection[0].slug));
 assert.equal(plan.length,collection.length);
});

test('seed-all requires the explicit owner login and fixes all ten openings to 0.01 testnet ZEC for 35 days',()=>{
 const config=ownerSeedConfig({username:'owner',ownerUsername:'owner',reserveZatoshis:'10000',auctionWindowSeconds:60});
 assert.equal(config.sellerName,'owner');assert.equal(config.reserveZatoshis,DEFAULT_GENESIS_STARTING_BID_ZATOSHIS);assert.equal(BigInt(config.reserveZatoshis),1_000_000n);assert.equal(config.auctionWindowSeconds,35*24*60*60);
 assert.throws(()=>ownerSeedConfig({username:'judge',ownerUsername:'owner'}),/owner account/);
});

test('seed-all refuses existing Genesis listings owned by another account or with a different start price/type',async()=>{
 const family=[{slug:collection[0].slug,current:{auctionId:'already-listed',opensAt:0,closesAt:3024000000}}];
 for(const auction of [
  {isOwner:false,sellerName:'owner',auctionKind:'digital-download',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:3024000000},
  {isOwner:true,sellerName:'someone else',auctionKind:'digital-download',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:3024000000},
  {isOwner:true,sellerName:'owner',auctionKind:'practice',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:3024000000},
  {isOwner:true,sellerName:'owner',auctionKind:'digital-download',reserve:'2000000',closesAt:3024000000},
  {isOwner:true,sellerName:'owner',auctionKind:'digital-download',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:5000},
 ]){
  const client={request:async()=>({auction})};
  await assert.rejects(verifyExistingOwnerAuctions(client,family,'owner'),/does not match the configured owner/);
 }
 await verifyExistingOwnerAuctions({request:async()=>({auction:{isOwner:true,sellerName:'owner',auctionKind:'digital-download',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:3024000000}})},family,'owner');
});

// All bytes below are synthetic fixtures, never supplied artwork or wallet keys.
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
test('the complete ten-file import is verified before any publication; corruption and duplicate bindings fail',async()=>{
 const originalsRoot=await mkdtemp(join(tmpdir(),'veil-collection-preflight-')),objects=[];
 for(const f of collection){const bytes=Buffer.alloc(f.bytes,7);await writeFile(join(originalsRoot,f.slug+'.png'),bytes,{mode:0o600});objects.push({slug:f.slug,file:f.slug+'.png',sha256:createHash('sha256').update(bytes).digest('hex')});}
 const manifest=join(originalsRoot,'import.json');await writeFile(manifest,JSON.stringify({objects}),{mode:0o600});
 assert.equal((await verifyCollectionOriginals({originalsRoot})).objects.length,10);
 const last=join(originalsRoot,collection.at(-1).slug+'.png'),bytes=await readFile(last);bytes[0]^=1;await writeFile(last,bytes);
 await assert.rejects(verifyCollectionOriginals({originalsRoot}),/integrity/);
 await writeFile(manifest,JSON.stringify({objects:[...objects.slice(0,9),objects[0]]}));
 await assert.rejects(verifyCollectionOriginals({originalsRoot}),/ten reviewed/);
});
test('owner publishing uses the same backed-up managed wallet, never a substitute covered receiver',async()=>{
 for(const [state,address,eligible,configured] of [['ready','same',true,'same'],['backup-required','same',true,'same'],['ready',null,true,'same'],['ready','same',false,'same'],['ready','same',true,'other']]){
  const client={request:async path=>path==='/api/digital/config'?{eligible,address:configured}:{state,address}};
  if(state==='ready'&&address&&eligible&&configured===address)assert.equal(await verifyOwnerReceiver(client),'same');
  else await assert.rejects(verifyOwnerReceiver(client),/exact receiver scanner-covered/);
 }
});
test('seed-all checks the authenticated username before uploads, reservations or key generation',async()=>{
 const calls=[];const client={request:async path=>{calls.push(path);return {username:'someone-else'};},upload:()=>assert.fail('No upload allowed')};
 await assert.rejects(seedCollection(client,{username:'owner',ownerUsername:'owner'}),/Authenticated account/);
 assert.deepEqual(calls,['/api/account']);assert.equal(ownerSeedConfig({username:'owner',ownerUsername:'owner',recurring:true}).recurring,false);
});

test('uncompleted auction publication requires its retained matching recovery key; verified history stays readable',async()=>{
 const journalRoot=await mkdtemp(join(tmpdir(),'veil-recovery-audit-')),id='11111111-1111-4111-8111-111111111111',families=[{current:{auctionId:id}}];
 const auction={id,publicKey:{n:'synthetic-n',e:'AQAB'},result:null},client={request:async()=>({auction})};
 await assert.rejects(verifyCollectionRecovery(client,families,journalRoot),/key is missing/);
 await writeFile(join(journalRoot,id+'.json'),JSON.stringify({auctionId:id,privateKey:{n:'wrong',e:'AQAB',d:'synthetic-only'}}),{mode:0o600});
 await assert.rejects(verifyCollectionRecovery(client,families,journalRoot),/key is missing/);
 await writeFile(join(journalRoot,id+'.json'),JSON.stringify({auctionId:id,privateKey:{n:'synthetic-n',e:'AQAB',d:'synthetic-only'}}));
 await verifyCollectionRecovery(client,families,journalRoot);
 auction.result={status:'zk-verified'};await verifyCollectionRecovery(client,families,join(journalRoot,'empty-history'));
});

test('all ten real seeding jobs retain RSA recovery keys before create and retry without duplicates or deadline extensions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'veil-ten-seed-')),originalsRoot=join(root,'originals'),journalRoot=join(root,'keys');
 const {mkdir}=await import('node:fs/promises');const {randomUUID}=await import('node:crypto');await mkdir(originalsRoot,{mode:0o700});
 const objects=[];for(const f of collection){const bytes=Buffer.alloc(f.bytes,9);await writeFile(join(originalsRoot,f.slug+'.png'),bytes,{mode:0o600});objects.push({slug:f.slug,file:f.slug+'.png',sha256:createHash('sha256').update(bytes).digest('hex')});}await writeFile(join(originalsRoot,'import.json'),JSON.stringify({objects}),{mode:0o600});
 const reservations=new Map(),auctions=new Map();let uploads=0,creates=0;
 const families=()=>collection.map(f=>{const e=reservations.get(f.slug);return {...f,current:e?{auctionId:e.bound?e.auction_id:null,closesAt:e.closes_at,opensAt:e.opensAt,state:e.bound?'open':'preparing'}:null};});
 const client={upload:async()=> 'synthetic-asset-'+(++uploads),request:async(path,body)=>{
  if(path==='/api/account')return {username:'owner'};
  if(path==='/api/digital/config')return {eligible:true,address:'synthetic-bound-receiver'};
  if(path==='/api/judging/wallet')return {state:'ready',address:'synthetic-bound-receiver'};
  if(path==='/api/judging/catalogue')return {families:families()};
  if(path==='/api/judging/worker/register')return {registered:true};
  if(path==='/api/judging/worker/reserve'){
   assert.equal(body.windowSeconds,3024000);let e=reservations.get(body.slug);if(!e){e={id:randomUUID(),auction_id:randomUUID(),opensAt:1000000,closes_at:1000000+3024000000,edition:1};reservations.set(body.slug,e);}return e;
  }
  if(path==='/api/judging/worker/bind'){const e=[...reservations.values()].find(v=>v.id===body.id);assert.ok(auctions.has(e.auction_id));e.bound=true;return {bound:true};}
  if(path==='/api/digital/drafts')return {draftId:randomUUID()};
  if(path==='/api/auctions'){
   creates++;assert.equal(body.auctionKind,'digital-download');assert.equal(body.sellerName,'owner');assert.equal(body.reserve,'1000000');assert.equal(body.paymentAddress,'synthetic-bound-receiver');assert.equal(auctions.has(body.id),false);
   const journal=JSON.parse(await readFile(join(journalRoot,body.id+'.json'),'utf8'));assert.equal(journal.phase,'creating-unknown');assert.equal(journal.privateKey.n,body.publicKey.n);assert.ok(journal.privateKey.d);
   auctions.set(body.id,{...body,isOwner:true});return {auction:auctions.get(body.id)};
  }
  if(path.startsWith('/api/auctions/'))return {auction:auctions.get(path.split('/').at(-1))};
  assert.fail('Unexpected mock endpoint '+path);
 }};
 const cfg={username:'owner',ownerUsername:'owner',originalsRoot,journalRoot,auctionWindowSeconds:60,reserveZatoshis:'1'};
 assert.equal((await seedCollection(client,cfg)).createdOrRecovered,10);assert.equal(uploads,20);assert.equal(creates,10);
 const deadlines=[...reservations.values()].map(e=>e.closes_at);const rerun=await seedCollection(client,cfg);assert.equal(rerun.createdOrRecovered,0);assert.equal(rerun.alreadyListed,10);assert.equal(creates,10);assert.equal(uploads,20);assert.deepEqual([...reservations.values()].map(e=>e.closes_at),deadlines);
});
