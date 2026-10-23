// Synthetic startup conditions; these are not live synchronization or wallet evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForNode} from '../scanner/testnet/wait-node.mjs';

function clock(){let time=0;return {now:()=>time,pause:async ms=>{time+=ms;}};}
test('wallet startup waits for authenticated testnet RPC and the separate indexer',async()=>{
 let requests=0,probes=0;
 const height=await waitForNode({...clock(),chainRpc:async()=>{requests++;if(requests===1)throw Error('Cookie not created');return {chain:'test',blocks:250};},probeIndexer:async()=>{if(++probes===1)throw Error('Indexer not listening');}});
 assert.equal(height,250);assert.equal(requests,3);assert.equal(probes,2);
});
test('wallet startup rejects mainnet immediately without probing the indexer',async()=>{
 await assert.rejects(waitForNode({...clock(),chainRpc:async()=>({chain:'main',blocks:100}),probeIndexer:()=>{assert.fail('Must not probe wrong-network node');}}),/TESTNET/);
});
test('missing node and incomplete initialization exhaust a finite startup deadline',async()=>{
 for(const info of [null,{chain:'test',blocks:0},{chain:'test',blocks:'100'}]){
  let calls=0;
  await assert.rejects(waitForNode({...clock(),timeoutMs:5000,chainRpc:async()=>{calls++;return info;},probeIndexer:()=>assert.fail('Node is not initialized')}),/deadline/);
  assert.equal(calls,3);
 }
});
test('startup barrier does not require or claim current-tip synchronization',async()=>{
 assert.equal(await waitForNode({...clock(),chainRpc:async()=>({chain:'test',blocks:100,estimatedheight:4500000,verificationprogress:0.00002}),probeIndexer:async()=>{}}),100);
});
