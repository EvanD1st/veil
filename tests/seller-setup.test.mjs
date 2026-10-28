// Isolated HTTP/SQLite onboarding; synthetic addresses, no wallet or network payments.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {initializeDatabase,openDatabase} from '../runtime/database.mjs';
import {createAccount,createSession,COOKIE,revokeSession} from '../runtime/accounts.mjs';
import {digitalHandler} from '../runtime/digital-files.mjs';
const address=JSON.parse(readFileSync(new URL('./fixtures/synthetic-receiver.json',import.meta.url),'utf8')).address;
function syntheticAddress(fill){
 const alphabet='qpzry9x8gf2tvdw0s3jn54khce6mua7l',prefix='ztestsapling',words=[];let acc=0,bits=0;
 for(const b of new Uint8Array(43).fill(fill)){acc=(acc<<8)|b;bits+=8;while(bits>=5){bits-=5;words.push((acc>>>bits)&31);}}if(bits)words.push((acc<<(5-bits))&31);
 const values=[...prefix].map(c=>c.charCodeAt(0)>>>5).concat([0],[...prefix].map(c=>c.charCodeAt(0)&31),words,[0,0,0,0,0,0]);let checksum=1;
 for(const value of values){const top=checksum>>>25;checksum=((checksum&0x1ffffff)<<5)^value;[0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3].forEach((g,i)=>{if((top>>>i)&1)checksum^=g;});}
 checksum^=1;return prefix+'1'+words.concat(Array.from({length:6},(_,i)=>(checksum>>>(5*(5-i)))&31)).map(x=>alphabet[x]).join('');
}
const alternate=syntheticAddress(0x14);

test('seller onboarding authenticates, bounds requests, isolates accounts and never grants approval from a request',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'veil-seller-setup-')),path=join(directory,'test.sqlite'),sellers=join(directory,'sellers.json'),saved={...process.env};
 initializeDatabase(path,resolve('drizzle'));const db=openDatabase(path);
 const first=await createAccount(db,'seller-one','synthetic-test-password-one'),second=await createAccount(db,'seller-two','synthetic-test-password-two');
 const cookies={[first]:COOKIE+'='+createSession(db,first),[second]:COOKIE+'='+createSession(db,second)};
 await writeFile(sellers,'{}',{mode:0o600});Object.assign(process.env,{VEIL_SQLITE_PATH:path,VEIL_DIGITAL_SELLERS_FILE:sellers,VEIL_DIGITAL_PUBLISHING_ENABLED:'1',VEIL_DIGITAL_ROOT:join(directory,'files')});
 let handler;const server=createServer((req,res)=>handler(req,res,()=>{res.writeHead(404);res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;handler=digitalHandler(db,origin);
 const call=(route,{user=first,body,headers={},method=body===undefined?'GET':'POST'}={})=>fetch(origin+route,{method,headers:{...(user?{Cookie:cookies[user]}:{}),...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const config=async user=>(await call('/api/digital/config',{user})).json();
 try{
  await t.test('anonymous, cross-origin, malformed and secret-bearing requests are rejected',async()=>{
   assert.equal((await call('/api/digital/receiver-request',{user:null,body:{address}})).status,401);
   assert.equal((await call('/api/digital/receiver-request',{body:{address},headers:{Origin:'https://attacker.invalid'}})).status,403);
   assert.equal((await call('/api/digital/receiver-request',{body:{address},headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
   for(const body of [{address:'not-an-address'},{address,viewingKey:'never-accepted'},{address,role:'admin'},{address,ready:true},null,[]])assert.equal((await call('/api/digital/receiver-request',{body})).status,400);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM digital_seller_requests').get().n,0);
  });
  await t.test('requests persist idempotently, remain pending, isolate addresses and confer no upload rights',async()=>{
   assert.equal((await config(first)).setup.state,'not-requested');
   assert.equal((await call('/api/digital/receiver-request',{body:{address}})).status,201);
   assert.equal((await call('/api/digital/receiver-request',{body:{address}})).status,200);
   assert.equal((await call('/api/digital/receiver-request',{body:{address:alternate}})).status,429);
   const own=await config(first);assert.equal(own.setup.state,'pending');assert.equal(own.setup.address,address);assert.equal(own.eligible,false);assert.equal(own.address,null);
   const other=await config(second);assert.equal(other.setup.state,'not-requested');assert.ok(!JSON.stringify(other).includes(address));
   assert.equal((await call('/api/digital/receiver-request',{user:second,body:{address}})).status,409);
   assert.equal((await call('/api/digital/drafts',{body:{}})).status,403);
   assert.equal((await call('/api/digital/uploads?kind=deliverable&format=png',{body:{}})).status,403);
   handler=digitalHandler(db,origin);assert.equal((await config(first)).setup.state,'pending');
  });
  await t.test('only the private operator map enables the matching receiver; pause and removal close publishing',async()=>{
   await writeFile(sellers,JSON.stringify({[first]:address}),{mode:0o600});
   let own=await config(first);assert.equal(own.eligible,true);assert.equal(own.setup.state,'ready');assert.equal(own.address,address);assert.equal((await config(second)).eligible,false);
   const queue=JSON.parse(execFileSync(process.execPath,['runtime/digital-admin.mjs','seller-requests'],{encoding:'utf8',env:process.env}));assert.equal(queue.length,1);assert.equal(queue[0].account_id,first);assert.equal(queue[0].state,'approved');assert.deepEqual(Object.keys(queue[0]).sort(),['account_id','receiver','requested_at','state','updated_at','username']);
   assert.equal((await call('/api/digital/receiver-request',{body:{address:alternate}})).status,409);
   await writeFile(sellers,JSON.stringify({[first]:alternate}));assert.equal((await config(first)).eligible,false);
   await writeFile(sellers,JSON.stringify({[first]:address}));
   process.env.VEIL_DIGITAL_PUBLISHING_ENABLED='0';own=await config(first);assert.equal(own.eligible,false);assert.equal(own.address,null);
   assert.equal((await call('/api/digital/receiver-request',{body:{address}})).status,503);
   process.env.VEIL_DIGITAL_PUBLISHING_ENABLED='1';await writeFile(sellers,'{}');assert.equal((await config(first)).eligible,false);
   await writeFile(sellers,'invalid JSON');assert.equal((await config(first)).eligible,false);
   await writeFile(sellers,'{}');
  });
  await t.test('bounded setup queue and request throttle reject excess without creating entries',async()=>{
   db.exec('BEGIN IMMEDIATE');try{for(let n=0;n<199;n++){const id='capacity-'+n;db.prepare('INSERT INTO veil_accounts VALUES(?,?,?,?,0,?)').run(id,'capacity-'+n,'synthetic','synthetic',Date.now());db.prepare('INSERT INTO digital_seller_requests VALUES(?,?,?,?)').run(id,'synthetic-unused-'+n,Date.now(),Date.now());}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
   assert.equal((await call('/api/digital/receiver-request',{user:second,body:{address:alternate}})).status,429);
   // Same-account retries are idempotent until the bounded operation throttle applies.
   handler=digitalHandler(db,origin);for(let n=0;n<40;n++)assert.equal((await call('/api/digital/receiver-request',{body:{address}})).status,200);
   assert.equal((await call('/api/digital/receiver-request',{body:{address}})).status,429);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM digital_seller_requests').get().n,200);
  });
  await t.test('revoked sessions cannot read or change seller setup',async()=>{
   revokeSession(db,cookies[first]);assert.equal((await call('/api/digital/config')).status,401);assert.equal((await call('/api/digital/receiver-request',{body:{address}})).status,401);
  });
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(directory,{recursive:true,force:true});}
});
