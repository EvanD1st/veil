import {test,expect} from '@playwright/test';
import {poseidon4} from 'poseidon-lite';
import {readFileSync} from 'node:fs';
const assets:Record<string,{url:string;size:number;sha256:string}[]>=JSON.parse(readFileSync(new URL('../../shared/veil/zk/assets.json',import.meta.url),'utf8'));
const witness={context:'123',reserve:'100',count:'3',winnerIndex:'2',winningAmount:'250',bidIds:['1','2','3','0','0','0','0','0'],amounts:['180','250','210','0','0','0','0','0'],salts:['11','22','33','0','0','0','0','0'],commitments:[] as string[]};
witness.commitments=witness.amounts.map((v,i)=>i<3?poseidon4([123n,BigInt(witness.bidIds[i]),BigInt(v),BigInt(witness.salts[i])]).toString():'0');
const signals=['123','100','3','2','250',...witness.bidIds,...witness.commitments];
async function prove(page:import('@playwright/test').Page){return page.evaluate(async({assets,witness,signals})=>{
 const progress:string[]=[];
 const result=await new Promise<{proof:Record<string,unknown>;publicSignals:string[]}>((resolve,reject)=>{
  const worker=new Worker('/zk/prover-worker.js');worker.onmessage=({data})=>{if(data.progress)progress.push(data.progress);if(data.error){worker.terminate();reject(Error(data.error));}if(data.result){worker.terminate();resolve(data.result);}};
  worker.onerror=()=>{worker.terminate();reject(Error('Worker failed'));};worker.postMessage({assets,witness});
 });
 const path='/shared/veil/zk/verify.ts';const {verifyHighestBid}=await import(path);await verifyHighestBid({circuitId:'veil-highest-bid-v2-8',...result},signals);
 return progress;
},{assets,witness,signals});}
test('cold and cached real proofs, with retry progress after transient asset errors',async({page})=>{
 await page.goto('/');let failures=0;await page.route('**/runtime-0.js',async route=>{if(failures++<2)await route.fulfill({status:503,body:'temporarily unavailable'});else await route.continue();});
 const start=Date.now(),cold=await prove(page);expect(cold.some(p=>p.includes('Retrying'))).toBeTruthy();expect(cold.some(p=>p.includes('stage 5 of 5'))).toBeTruthy();
 await page.unroute('**/runtime-0.js');const second=Date.now();await prove(page);const seeded=Date.now();
 const before=await (await page.request.get('/__veil/assets')).json();const cached=await prove(page);const after=await (await page.request.get('/__veil/assets')).json();
 for(const part of Object.values(assets).flat())expect(after[part.url]??0).toBe(before[part.url]??0);
 expect(cached.some(p=>p.includes('MB'))).toBeTruthy();console.log('Cold/retry proof ms',second-start,'first cached proof ms',seeded-second,'repeat cached proof ms',Date.now()-seeded);
});
test('runtime corruption is rejected by the actual browser worker',async({page})=>{
 await page.goto('/');await page.route('**/runtime-0.js',async route=>{const response=await route.fetch();const bytes=await response.body();bytes[0]^=1;await route.fulfill({response,body:bytes});});
 await expect(prove(page)).rejects.toThrow('integrity check failed');
});
test('worker failure and client timeout return errors rather than proofs',async({page})=>{
 await page.goto('/');await page.route('**/prover-worker.js',route=>route.fulfill({contentType:'application/javascript',body:'throw Error("Deliberate test worker failure");'}));
 const error=await page.evaluate(async witness=>{const path='/frontend/veil/zk/client.ts';const {runProofWorker}=await import(path);try{await runProofWorker(witness,()=>{});return 'unexpected success';}catch(e){return (e as Error).message;}},witness);expect(error).toContain('could not run');
 await page.unroute('**/prover-worker.js');let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});await page.route('**/runtime-0.js',async route=>{await gate;await route.abort().catch(()=>{});});
 const timeout=await page.evaluate(async witness=>{const path='/frontend/veil/zk/client.ts';const {runProofWorker}=await import(path);try{await runProofWorker(witness,()=>{},undefined,100);return 'unexpected success';}catch(e){return (e as Error).message;}},witness);release();expect(timeout).toContain('timed out');
});


test('a corrupt persistent-cache entry is rejected and removed before runtime execution',async({page})=>{
 await page.goto('/');const runtime=assets.runtime[0];
 await page.evaluate(async runtime=>{const cache=await caches.open('veil-verified-proof-assets-v1');await cache.put(runtime.url+'?sha256='+runtime.sha256,new Response(new Uint8Array(runtime.size)));},runtime);
 await expect(prove(page)).rejects.toThrow('integrity check failed');
 const remains=await page.evaluate(async runtime=>!!await (await caches.open('veil-verified-proof-assets-v1')).match(runtime.url+'?sha256='+runtime.sha256),runtime);expect(remains).toBe(false);
});
