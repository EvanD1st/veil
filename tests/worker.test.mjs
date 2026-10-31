import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';
const source=await readFile('frontend/public/zk/prover-worker.js','utf8');
const assets=JSON.parse(await readFile('shared/veil/zk/assets.json','utf8'));
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
test('wrong hash never retries or executes runtime',async()=>{let calls=0;const bytes=await readFile('frontend/public'+assets.runtime[0].url);bytes[0]^=1;const messages=await failure(async()=>{calls++;return new Response(bytes);});assert.equal(calls,1);assert.match(messages.at(-1).error,/integrity/);});
test('oversized and truncated assets fail closed',async()=>{for(const size of [10,assets.runtime[0].size+1]){let calls=0;await failure(async()=>{calls++;return new Response(new Uint8Array(size));});assert.equal(calls,1);}});
test('bounded parallel downloads retain manifest order and verify every part before proving',async()=>{
 const buffers=new Map([['/runtime',Buffer.from('runtime')],['/wasm',Buffer.from('wasm')],...Array.from({length:4},(_,n)=>['/key'+n,Buffer.from('key-part-'+n)])]);
 const part=url=>({url,size:buffers.get(url).length,sha256:createHash('sha256').update(buffers.get(url)).digest('hex')});
 const manifest={runtime:[part('/runtime')],wasm:[part('/wasm')],zkey:Array.from({length:4},(_,n)=>part('/key'+n))};let active=0,peak=0,proved=false;const messages=[];
 const context=vm.createContext({AbortSignal,crypto:webcrypto,Uint8Array,Blob,URL,setTimeout,postMessage:m=>messages.push(m),close:()=>{},
  fetch:async url=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return new Response(buffers.get(url));},
  importScripts:()=>{context.snarkjs={plonk:{fullProve:async(_w,wasm,key)=>{assert.deepEqual(Buffer.from(wasm),buffers.get('/wasm'));assert.deepEqual(Buffer.from(key),Buffer.concat(manifest.zkey.map(p=>buffers.get(p.url))));proved=true;return {proof:{},publicSignals:[]};}}};}
 });vm.runInContext('self=globalThis;',context);vm.runInContext(source,context);await context.onmessage({data:{assets:manifest,witness:{}}});
 assert.equal(peak,2);assert.equal(proved,true);assert.ok(messages.some(m=>m.result));assert.ok(messages.every(m=>!m.error));
});
