import test from 'node:test';
import assert from 'node:assert/strict';
import collection from '../judging/collection.json' with {type:'json'};
import {familiesToSeed,ownerSeedConfig,verifyExistingOwnerAuctions,DEFAULT_GENESIS_STARTING_BID_ZATOSHIS} from '../judging/demo-client.mjs';

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
 const family=[{slug:collection[0].slug,current:{auctionId:'already-listed',closesAt:4000}}];
 for(const auction of [
  {isOwner:false,sellerName:'owner',auctionKind:'digital-download',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:4000},
  {isOwner:true,sellerName:'someone else',auctionKind:'digital-download',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:4000},
  {isOwner:true,sellerName:'owner',auctionKind:'practice',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:4000},
  {isOwner:true,sellerName:'owner',auctionKind:'digital-download',reserve:'2000000',closesAt:4000},
  {isOwner:true,sellerName:'owner',auctionKind:'digital-download',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:5000},
 ]){
  const client={request:async()=>({auction})};
  await assert.rejects(verifyExistingOwnerAuctions(client,family,'owner'),/does not match the configured owner/);
 }
 await verifyExistingOwnerAuctions({request:async()=>({auction:{isOwner:true,sellerName:'owner',auctionKind:'digital-download',reserve:DEFAULT_GENESIS_STARTING_BID_ZATOSHIS,closesAt:4000}})},family,'owner');
});
