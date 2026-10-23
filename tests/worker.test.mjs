import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const source=await readFile('public/zk/prover-worker.js','utf8');
const assets=JSON.parse(await readFile('lib/veil/zk/assets.json','utf8'));
async function failure(fetch){
 const messages=[];let closed=false,imported=false;
 const context=vm.createContext({fetch,AbortSignal,crypto:webcrypto,Uint8Array,Blob,URL,setTimeout:callback=>{callback();return 0;},
  postMessage:m=>messages.push(m),importScripts:()=>{imported=true;},close:()=>{closed=true;}});
 vm.runInContext('self=globalThis;',context);vm.runInContext(source,context);await context.onmessage({data:{assets,witness:{}}});
 assert.ok(messages.some(m=>m.error));assert.ok(messages.every(m=>!m.result));assert.equal(closed,true);assert.equal(imported,false);return messages;
}
test('transient HTTP failures have exactly three attempts, with visible retries',async()=>{let calls=0;const messages=await failure(async()=>{calls++;return new Response('',{status:503});});assert.equal(calls,3);assert.equal(messages.filter(m=>m.phase==='retry').length,2);});
test('permanent HTTP errors do not retry',async()=>{let calls=0;await failure(async()=>{calls++;return new Response('',{status:404});});assert.equal(calls,1);});
test('network interruption retries are bounded',async()=>{let calls=0;await failure(async()=>{calls++;throw Error('Connection interrupted');});assert.equal(calls,3);});
test('wrong hash never retries or executes runtime',async()=>{let calls=0;const bytes=await readFile('public'+assets.runtime[0].url);bytes[0]^=1;const messages=await failure(async()=>{calls++;return new Response(bytes);});assert.equal(calls,1);assert.match(messages.at(-1).error,/integrity/);});
test('oversized and truncated assets fail closed',async()=>{for(const size of [10,assets.runtime[0].size+1]){let calls=0;await failure(async()=>{calls++;return new Response(new Uint8Array(size));});assert.equal(calls,1);}});
