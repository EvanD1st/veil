import assert from 'node:assert/strict';
import{loopbackFetch as fetch}from'../tests/loopback-http.mjs';
import {mkdtemp,readFile,writeFile,cp} from 'node:fs/promises';import{tmpdir}from'node:os';import{resolve,join,relative,isAbsolute}from'node:path';import{spawn}from'node:child_process';import{createServer}from'node:net';
import{pathToFileURL}from'node:url';import{createRequire}from'node:module';import{checkDeployedAssets}from'./check-deployed-assets.mjs';
// Copy the complete artifact outside the repository: Node must not resolve a
// missing packaged dependency from the CI checkout's ancestor node_modules.
const temp=await mkdtemp(join(tmpdir(),'veil-ubuntu-smoke-')),source=resolve(process.env.VEIL_ARTIFACT_ROOT??'dist/standalone'),root=join(temp,'app');
await cp(source,root,{recursive:true});
const {initializeDatabase,openDatabase}=await import(pathToFileURL(join(root,'runtime/database.mjs'))),{createAccount}=await import(pathToFileURL(join(root,'runtime/accounts.mjs'))),artifactRequire=createRequire(join(root,'package.json'));
const decoderPath=relative(root,artifactRequire.resolve('sharp'));assert.ok(!isAbsolute(decoderPath)&&decoderPath!=='..'&&!decoderPath.startsWith('..'+(process.platform==='win32'?'\\':'/')),'Decoder must resolve inside the artifact.');
assert.equal(artifactRequire('sharp').versions.sharp,'0.35.4');
const database=join(temp,'veil.sqlite');
initializeDatabase(database,join(root,'drizzle'));const db=openDatabase(database);
await createAccount(db,'seller','ci-only-password-seller','native-seller');await createAccount(db,'bidder','ci-only-password-bidder','native-bidder');db.close();
const receiver=JSON.parse(await readFile(process.env.VEIL_TEST_RECEIVER_FILE??'tests/fixtures/synthetic-receiver.json','utf8')).address,sellers=join(temp,'sellers.json');await writeFile(sellers,JSON.stringify({'native-seller':receiver}),{mode:0o600});
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const server=spawn(process.execPath,[join(root,'runtime/server.mjs')],{cwd:root,env:{...process.env,PORT:String(port),VEIL_SQLITE_PATH:database,VEIL_DIGITAL_ROOT:join(temp,'originals'),VEIL_DIGITAL_SELLERS_FILE:sellers,VEIL_DIGITAL_PUBLISHING_ENABLED:'1',VEIL_PUBLIC_ORIGIN:'https://veil.example'},stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',b=>{output+=b;});server.stderr.on('data',b=>{output+=b;});
const origin='http://127.0.0.1:'+port;
async function request(path,init={}){return fetch(origin+path,{...init,headers:{Host:'veil.example',...init.headers},redirect:'manual'});}
async function login(username,password){const response=await request('/signin-with-chatgpt',{method:'POST',headers:{Origin:'https://veil.example','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password})});assert.equal(response.status,303);return response.headers.get('set-cookie').split(';')[0];}
try{
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)break;try{const r=await request('/');if(r.status===303){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'Standalone server did not start: '+output);
 assert.equal((await request('/api/auctions',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'fake@example.invalid'}})).status,401);
 const seller=await login('seller','ci-only-password-seller'),bidder=await login('bidder','ci-only-password-bidder');
 const get=await request('/api/auctions',{headers:{Cookie:seller}});assert.equal(get.status,200,'Real session did not authenticate: '+await get.clone().text());
 const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
 const image=await artifactRequire('sharp')({create:{width:32,height:32,channels:3,background:'#f4d462'}}).png().toBuffer();
 const ids=[];for(const kind of ['preview','deliverable']){const r=await request('/api/digital/uploads?kind='+kind+'&format=png',{method:'POST',headers:{Cookie:seller,Origin:'https://veil.example','Content-Type':'application/octet-stream','Content-Length':String(image.length)},body:image});assert.equal(r.status,201,await r.clone().text());ids.push((await r.json()).asset.id);}
 const draft=await request('/api/digital/drafts',{method:'POST',headers:{Cookie:seller,Origin:'https://veil.example','Content-Type':'application/json'},body:JSON.stringify({previewId:ids[0],fileId:ids[1],category:'Digital Art',license:'Personal demonstration use; copyright retained.',edition:'',provenance:'Locally generated synthetic CI demonstration image.'})});assert.equal(draft.status,201);const draftId=(await draft.json()).draftId;
 const lot={id:crypto.randomUUID(),title:'Native SQLite smoke lot',description:'Disposable CI data only.',sellerName:'CI seller',category:'Digital Art',artwork:'orbit',digitalDraftId:draftId,paymentAddress:receiver,reserve:'100000000',closesAt:Date.now()+180000,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey),paymentWindowHours:24};
 const created=await request('/api/auctions',{method:'POST',headers:{Cookie:seller,Origin:'https://veil.example','Content-Type':'application/json'},body:JSON.stringify(lot)});assert.equal(created.status,201,'Native auction create failed: '+await created.clone().text());
 const detail=await request('/api/auctions/'+lot.id,{headers:{Cookie:bidder}});assert.equal(detail.status,200);assert.equal((await detail.json()).auction.isOwner,false);
 assert.equal((await request('/api/auctions/'+lot.id+'/envelopes',{headers:{Cookie:bidder}})).status,403);
 assert.equal((await request('/api/auctions/'+lot.id+'/envelopes',{headers:{Cookie:seller}})).status,409,'Seller envelopes must remain locked before close.');
 const manifest=JSON.parse(await readFile(join(root,'proof-assets.json'),'utf8'));
 await checkDeployedAssets(origin,manifest,(url,init)=>fetch(url,{...init,headers:{Host:'veil.example'}}));
 const logout=await request('/signout-with-chatgpt',{method:'POST',headers:{Cookie:seller,Origin:'https://veil.example','Content-Type':'application/x-www-form-urlencoded'},body:''});assert.equal(logout.status,303);assert.equal((await request('/api/auctions',{headers:{Cookie:seller}})).status,401);
 console.log('Ubuntu artifact passed real HTTP login/logout, forged-header rejection, distinct accounts, persistent SQLite create/permissions and all proof-asset hashes.');
}finally{server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}
