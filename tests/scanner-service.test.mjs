// Synthetic queue/transport inputs. These are not actual wallet RPC captures or payment evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {generateKeyPairSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openOutbox,ScannerWorker,transport} from '../scanner/service.mjs';
const address=JSON.parse(readFileSync('tests/fixtures/synthetic-receiver.json','utf8')).address;
const auctionId='11111111-1111-4111-8111-111111111111',bidId='22222222-2222-4222-8222-222222222222';
const invoice={version:1,network:'testnet',invoiceId:'aa'.repeat(32),auctionId,bidId,address,amount:'1',memo:`VEIL:${auctionId}:${bidId}`};
async function setup(exchange,scan,receiver=address){const directory=await mkdtemp(join(tmpdir(),'veil-outbox-')),path=join(directory,'private.sqlite');const db=openOutbox(path),key=generateKeyPairSync('ed25519').privateKey;const worker=new ScannerWorker({db,key,receiver,exchange,scan,now:()=>1000000});return {db,path,worker,key};}
const job={id:'job',leaseId:'lease',leaseUntil:1300000,invoice,txid:'bb'.repeat(32),output:7};
function report(){return {version:1,invoiceId:invoice.invoiceId,network:'testnet',txid:job.txid,output:7,pool:'sapling',address,amount:'1',memo:invoice.memo,status:'not-confirmed',blockHash:null,blockHeight:null,tipHeight:100,confirmations:0,observedAt:1000000,expiresAt:1300000};}
test('signed outbox survives restart and lost acknowledgements without rescanning or duplicate payment',async()=>{
 let scans=0,deliveries=0;
 const exchange=async payload=>{if(payload.action==='claim')return {job};deliveries++;if(deliveries===1)throw Error('Lost ACK');return {accepted:true};};
 const {db,path,worker,key}=await setup(exchange,async()=>{scans++;return report();});
 assert.equal(await worker.tick(),'queued-delivery');assert.equal(scans,1);await assert.rejects(worker.tick());
 const original=db.prepare('SELECT payload FROM outbox').get().payload;db.close();
 const recovered=openOutbox(path),next=new ScannerWorker({db:recovered,key,receiver:address,exchange,scan:()=>{throw Error('Must not rescan');},now:()=>1000001});
 assert.equal(recovered.prepare('SELECT payload FROM outbox').get().payload,original);assert.equal(await next.tick(),'delivered');assert.equal(recovered.prepare('SELECT COUNT(*) n FROM outbox').get().n,0);assert.equal(scans,1);recovered.close();
});
test('RPC outage, wrong receiver and late observations produce no signed report',async()=>{
 for(const [scan,receiver]of [[async()=>{throw Error('Sync unavailable');},address],[async()=>report(),'wrong-receiver'],[async()=>({...report(),expiresAt:1000001}),address]]){
  const calls=[];const {db,worker}=await setup(async payload=>{calls.push(payload);return payload.action==='claim'?{job}:{accepted:true};},scan,receiver);
  assert.equal(await worker.tick(),'unavailable');assert.equal(db.prepare('SELECT COUNT(*) n FROM outbox').get().n,0);assert.equal(calls.at(-1).action,'unavailable');db.close();
 }
});
test('expired outbox is dropped, never redelivered with extended freshness',async()=>{
 const calls=[];const {db,worker}=await setup(async payload=>{calls.push(payload);return {job:null};},async()=>report());
 db.prepare('INSERT INTO outbox VALUES(?,?,?)').run('expired',JSON.stringify({action:'report'}),999999);
 assert.equal(await worker.tick(),'idle');assert.deepEqual(calls,[{action:'claim'}]);db.close();
});
test('HTTPS transport restricts origins, credentials, redirects, body size and authentication',async()=>{
 for(const origin of ['http://example.com','https://user:secret@example.com','https://example.com/path','https://example.com?x=1'])assert.throws(()=>transport(origin,'a'.repeat(64)));
 const send=transport('https://veil.example','a'.repeat(64),async(url,init)=>{assert.equal(String(url),'https://veil.example/api/scanner/jobs');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer '+'a'.repeat(64));return Response.json({job:null});});
 assert.deepEqual(await send({action:'claim'}),{job:null});
 await assert.rejects(transport('https://veil.example','a'.repeat(64),async()=>new Response('x'.repeat(12001)))({action:'claim'}),/large/);
});
