// Synthetic viewing-key strings and RPCs only; never reads a real wallet.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {PrivateState} from '../backend/judging/private-state.mjs';
import {enrollOwnerReceiver,importViewingKeyRpc,verifyIncomingCoverage} from '../backend/judging/owner-enrollment.mjs';
const address=JSON.parse(await readFile('tests/fixtures/synthetic-receiver.json','utf8')).address;
const fakeKey='zxviewtestsapling1'+'a'.repeat(120);
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'veil-owner-view-')),state=new PrivateState(root),calls=[];
 return {root,state,calls,options:{ownerAccountId:randomUUID(),address,state,coverage:async()=>true,attempts:4,wait:async()=>{},exportViewing:async()=>({network:'testnet',address,defaultAddress:address,birthday:4540000,viewingKey:fakeKey}),importViewing:async(key,birthday)=>{calls.push([key,birthday]);return {address_type:'sapling',address};},readiness:async()=>({blocks:4540020})}};
}
test('owner enrollment imports the exact viewing key/birthday, waits for two readiness passes, retains no key and resumes idempotently',async()=>{
 const {root,state,calls,options}=await fixture();let checks=0;options.readiness=async()=>{checks++;if(checks===2)throw Error('Scanning');return {blocks:4540020};};
 const receipt=await enrollOwnerReceiver(options);assert.equal(receipt.phase,'ready');assert.equal(checks,4);assert.equal(receipt.receiver,address);assert.deepEqual(calls,[[fakeKey,4540000]]);
 assert.equal((await state.read('owner-receiver.json')).phase,'ready');assert.ok(!(await readFile(join(root,'owner-receiver.json'),'utf8')).includes(fakeKey));
 assert.equal((await enrollOwnerReceiver(options)).phase,'ready');assert.equal(calls.length,2);
});
test('receiver mismatch, changed identity or mismatched imported account cannot become ready',async()=>{
 const {options,state}=await fixture();
 await assert.rejects(enrollOwnerReceiver({...options,exportViewing:async()=>({network:'mainnet'})}),/export did not match/);assert.equal(await state.read('owner-receiver.json'),null);
 await assert.rejects(enrollOwnerReceiver({...options,importViewing:async()=>({address:'wrong'})}),/Imported viewing account/);assert.notEqual((await state.read('owner-receiver.json')).phase,'ready');
 await assert.rejects(enrollOwnerReceiver({...options,ownerAccountId:randomUUID()}),/identity changed/);
});
test('import uncertainty and incomplete scanning retain intent and never emit a ready receipt',async()=>{
 const {options,state}=await fixture();
 await assert.rejects(enrollOwnerReceiver({...options,importViewing:async()=>{throw Error('Uncertain');}}),/Uncertain/);assert.equal((await state.read('owner-receiver.json')).phase,'importing');
 let checks=0;await assert.rejects(enrollOwnerReceiver({...options,readiness:async()=>{if(checks++)throw Error('Scanning');return {blocks:4540020};}}),/still scanning/);assert.equal((await state.read('owner-receiver.json')).phase,'scanning');
});
test('the private importer is fixed to one local viewing-key method, sends credentials privately and rejects remote RPC',async()=>{
 assert.throws(()=>importViewingKeyRpc({ZALLET_RPC_URL:'https://remote.example/',ZALLET_COOKIE_FILE:'/private/cookie'}),/local/);
 const root=await mkdtemp(join(tmpdir(),'veil-import-rpc-')),cookie=join(root,'cookie');await writeFile(cookie,'synthetic:ci-only',{mode:0o600});
 const call=importViewingKeyRpc({ZALLET_RPC_URL:'http://127.0.0.1:12345/',ZALLET_COOKIE_FILE:cookie},async(url,req)=>{
  assert.equal(url.hostname,'127.0.0.1');assert.equal(req.redirect,'error');const b=JSON.parse(req.body);assert.equal(b.method,'z_importviewingkey');assert.deepEqual(b.params,[fakeKey,'whenkeyisnew',4540000]);return new Response(JSON.stringify({jsonrpc:'2.0',id:'seller-import',result:{address_type:'sapling',address}}));
 });assert.equal((await call(fakeKey,4540000)).address,address);
});

 test('global readiness cannot approve an imported account without actual incoming-output coverage',async()=>{
 const {options,state}=await fixture();
 await assert.rejects(enrollOwnerReceiver({...options,coverage:undefined}),/coverage is required/);
 await assert.rejects(enrollOwnerReceiver({...options,coverage:async()=>false}),/still scanning/);
 assert.equal((await state.read('owner-receiver.json')).phase,'scanning');
 await assert.rejects(enrollOwnerReceiver({...options,coverage:async()=>{throw Error('Unknown receipt');}}),/still scanning/);
 assert.equal((await state.read('owner-receiver.json')).phase,'scanning');
 });

test('coverage requires exact incoming amount, memo, output and active-chain inclusion',async()=>{
 const txid='a'.repeat(64),blockhash='b'.repeat(64),best='c'.repeat(64),now=Math.floor(Date.now()/1000);
 const receipt={txid,destination:address,sapling_output:1,amount:'200000',memo:'synthetic coverage receipt'};
 const note={pool:'sapling',output:1,outgoing:false,walletInternal:false,address,valueZat:200000,memo:Buffer.from(receipt.memo).toString('hex').padEnd(1024,'0')};
 const tx={txid,status:'mined',blockhash,confirmations:4,outputs:[note]};
 const wallet=async method=>method==='z_viewtransaction'?tx:{locked:false,node_tip:{height:100,blockhash:best},wallet_tip:{height:100,blockhash:best},fully_synced_height:100,sync_work_remaining:null};
 const chain=async method=>method==='getblockchaininfo'?{chain:'test',blocks:100,headers:100,estimatedheight:100,verificationprogress:1,bestblockhash:best}:method==='getblockheader'?{hash:best,height:100,confirmations:1,time:now}:method==='getblock'?{hash:blockhash,height:97,confirmations:4,tx:[txid]}:blockhash;
 assert.equal(await verifyIncomingCoverage(receipt,address,wallet,chain),true);
 for(const change of [{valueZat:199999},{outgoing:true},{walletInternal:true},{memo:'00'.repeat(512)},{output:2}]){
 const prior={...note};Object.assign(note,change);assert.equal(await verifyIncomingCoverage(receipt,address,wallet,chain),false);Object.assign(note,prior);
 }
 assert.equal(await verifyIncomingCoverage(receipt,address,wallet,async(m,p)=>m==='getblockhash'?'d'.repeat(64):chain(m,p)),false);
 await assert.rejects(verifyIncomingCoverage({...receipt,destination:'wrong'},address,wallet,chain),/retained incoming/);
});
