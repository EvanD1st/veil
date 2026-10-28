import test from 'node:test';
import assert from 'node:assert/strict';
import collection from '../judging/collection.json' with {type:'json'};
import {familiesToSeed} from '../judging/demo-client.mjs';

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
