// Synthetic queue/transport inputs. These are not actual wallet RPC captures or payment evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {generateKeyPairSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openOutbox,ScannerWorker,transport,configuredReceivers} from '../scanner/service.mjs';
const address=JSON.parse(readFileSync('tests/fixtures/synthetic-receiver.json','utf8')).address;
const auctionId='11111111-1111-4111-8111-111111111111',bidId='22222222-2222-4222-8222-222222222222';
const invoice={version:1,network:'testnet',invoiceId:'aa'.repeat(32),auctionId,bidId,address,amount:'1',memo:`VEIL:${auctionId}:${bidId}`};
async function setup(exchange,scan,receiver=address,receivers=[receiver]){const directory=await mkdtemp(join(tmpdir(),'veil-outbox-')),path=join(directory,'private.sqlite');const db=openOutbox(path),key=generateKeyPairSync('ed25519').privateKey;const worker=new ScannerWorker({db,key,receivers,exchange,scan,now:()=>1000000});return {db,path,worker,key};}
const job={id:'job',leaseId:'lease',leaseUntil:1300000,invoice,txid:'bb'.repeat(32),output:7};
function report(){return {version:1,invoiceId:invoice.invoiceId,network:'testnet',txid:job.txid,output:7,pool:'sapling',address,amount:'1',memo:invoice.memo,status:'not-confirmed',blockHash:null,blockHeight:null,tipHeight:100,confirmations:0,observedAt:1000000,expiresAt:1300000};}
function syntheticSaplingAddress(fill){
 const alphabet='qpzry9x8gf2tvdw0s3jn54khce6mua7l',prefix='ztestsapling',bytes=new Uint8Array(43).fill(fill),words=[];let acc=0,bits=0;
 for(const b of bytes){acc=(acc<<8)|b;bits+=8;while(bits>=5){bits-=5;words.push((acc>>>bits)&31);}}
 if(bits)words.push((acc<<(5-bits))&31);
 const input=[...prefix].map(c=>c.charCodeAt(0)>>>5).concat([0],[...prefix].map(c=>c.charCodeAt(0)&31),words,[0,0,0,0,0,0]);let checksum=1;
 for(const value of input){const top=checksum>>>25;checksum=((checksum&0x1ffffff)<<5)^value;[0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3].forEach((g,i)=>{if((top>>>i)&1)checksum^=g;});}
 checksum^=1;return prefix+'1'+words.concat(Array.from({length:6},(_,i)=>(checksum>>>(5*(5-i)))&31)).map(x=>alphabet[x]).join('');
}
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
 for(const [scan,receiver]of [[async()=>{throw Error('Sync unavailable');},address],[async()=>report(),syntheticSaplingAddress(0x14)],[async()=>({...report(),expiresAt:1000001}),address]]){
  const calls=[];const {db,worker}=await setup(async payload=>{calls.push(payload);return payload.action==='claim'?{job}:{accepted:true};},scan,receiver);
  assert.equal(await worker.tick(),'unavailable');assert.equal(db.prepare('SELECT COUNT(*) n FROM outbox').get().n,0);assert.equal(calls.at(-1).action,'unavailable');db.close();
 }
});
test('scanner allowlist supports multiple imported seller receivers and rejects every unlisted invoice',async()=>{
 const second=syntheticSaplingAddress(0x14);assert.notEqual(second,address);
 assert.deepEqual(configuredReceivers({VEIL_SCANNER_RECEIVERS:JSON.stringify([address,second])}),[address,second]);
 assert.throws(()=>configuredReceivers({VEIL_SCANNER_RECEIVERS:JSON.stringify([address,address])}));
 assert.throws(()=>configuredReceivers({VEIL_SCANNER_RECEIVERS:'["not-an-address"]'}));
 const configDir=await mkdtemp(join(tmpdir(),'veil-receivers-')),configPath=join(configDir,'receivers.json');await writeFile(configPath,JSON.stringify([address,second]),{mode:0o600});assert.deepEqual(configuredReceivers({VEIL_SCANNER_RECEIVERS_FILE:configPath}),[address,second]);
 if(process.platform!=='win32'){await chmod(configPath,0o644);assert.throws(()=>configuredReceivers({VEIL_SCANNER_RECEIVERS_FILE:configPath}));}
 const secondInvoice={...invoice,address:second},secondJob={...job,invoice:secondInvoice};let scanned=0;
 const directory=await mkdtemp(join(tmpdir(),'veil-outbox-multi-')),db=openOutbox(join(directory,'private.sqlite')),key=generateKeyPairSync('ed25519').privateKey;
 const worker=new ScannerWorker({db,key,receivers:[address,second],exchange:async payload=>payload.action==='claim'?{job:secondJob}:{accepted:true},scan:async(inv)=>{scanned++;return {...report(),invoiceId:inv.invoiceId,address:inv.address,memo:inv.memo};},now:()=>1000000});
 assert.equal(await worker.tick(),'queued-delivery');assert.equal(scanned,1);const signed=JSON.parse(db.prepare('SELECT payload FROM outbox').get().payload).signed;assert.equal(signed.report.address,second);db.close();
 const rejectedDir=await mkdtemp(join(tmpdir(),'veil-outbox-unlisted-')),rejectedDb=openOutbox(join(rejectedDir,'private.sqlite')),replies=[];
 const rejected=new ScannerWorker({db:rejectedDb,key,receivers:[address],exchange:async payload=>{replies.push(payload);return payload.action==='claim'?{job:secondJob}:{accepted:true};},scan:async()=>{throw Error('Unlisted receiver must not be scanned');},now:()=>1000000});
 assert.equal(await rejected.tick(),'unavailable');assert.equal(replies.at(-1).action,'unavailable');assert.equal(rejectedDb.prepare('SELECT COUNT(*) n FROM outbox').get().n,0);rejectedDb.close();
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
