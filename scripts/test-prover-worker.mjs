// Exercise the shipped classic worker and browser snarkjs runtime with web APIs.
// This is a JS integration test, not a browser/UI test.
import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {webcrypto} from 'node:crypto';
import {poseidon4} from 'poseidon-lite';
import verify from '../shared/veil/zk/vendor/plonk_verify.js';
const assets=JSON.parse(await readFile('shared/veil/zk/assets.json','utf8'));
const witness={context:'123',reserve:'100',count:'3',winnerIndex:'2',winningAmount:'250',bidIds:['1','2','3','0','0','0','0','0'],amounts:['180','250','210','0','0','0','0','0'],salts:['11','22','33','0','0','0','0','0']};
witness.commitments=witness.amounts.map((v,i)=>i<3?poseidon4([123n,BigInt(witness.bidIds[i]),BigInt(v),BigInt(witness.salts[i])]).toString():'0');
const runtime=await readFile('frontend/public'+assets.runtime[0].url,'utf8');
let resolve,reject;const complete=new Promise((a,b)=>{resolve=a;reject=b;});
const context=vm.createContext({console,Uint8Array,Uint16Array,Uint32Array,Int32Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,WebAssembly,Blob,URL,crypto:webcrypto,setTimeout,clearTimeout,performance,atob,btoa,
 fetch:async url=>new Response(await readFile('frontend/public'+url)),AbortSignal,
 importScripts:()=>vm.runInContext(runtime,context),
 postMessage:data=>{if(data.progress)console.log(data.progress);if(data.error)reject(Error(data.error));if(data.result)resolve(data.result);},close:()=>{}});
vm.runInContext('self=globalThis;',context);
vm.runInContext(await readFile('frontend/public/zk/prover-worker.js','utf8'),context);
context.onmessage({data:{assets,witness}});
const result=await complete;
const vk=JSON.parse(await readFile('shared/veil/zk/verification_key.json','utf8'));
if(!await verify(vk,result.publicSignals,result.proof))throw Error('Browser runtime proof failed verification');
console.log('Shipped browser runtime proof verified');
