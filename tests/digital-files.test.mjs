// Isolated native files/SQLite and source service code. ALL payment/result observations here are SYNTHETIC.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {createServer,request as httpRequest} from 'node:http';
import Module,{createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import sharp from 'sharp';
import {initializeDatabase,openDatabase,d1Adapter} from '../runtime/database.mjs';
import {createAccount,authenticate} from '../runtime/accounts.mjs';
import {authenticationHandler} from '../runtime/http-auth.mjs';
import {digitalHandler,verifyDraftFiles,LIMITS} from '../runtime/digital-files.mjs';
import {reviewableReport} from '../runtime/digital-review.mjs';
import {reportMessage} from '../scanner/scan.mjs';
const require=createRequire(import.meta.url),receiver=require('./fixtures/synthetic-receiver.json').address;

test('digital purchase boundary: real local files and HTTP, synthetic signed payment evidence only',async t=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'veil-digital-test-')),path=join(dir,'private.sqlite'),root=join(dir,'private-files'),sellers=join(dir,'seller-coverage.json');
 initializeDatabase(path,resolve('drizzle'));let db=openDatabase(path),server,origin,handler,auth;
 const saved={...process.env},realLoad=Module._load,realNow=Date.now;
 const ids={};for(const name of ['seller','buyer','loser','outsider'])ids[name]=await createAccount(db,name,'synthetic-test-password-'+name);
 const cookies={};for(const name of Object.keys(ids))cookies[name]='__Host-veil_session='+await authenticate(db,name,'synthetic-test-password-'+name);
 // Use the exact native cookie name without reflecting session bytes in test diagnostics.
 const {sessionCookie}=await import('../runtime/accounts.mjs');for(const name of Object.keys(ids))cookies[name]=sessionCookie(cookies[name].split('=')[1]).split(';')[0];
 await fs.writeFile(sellers,JSON.stringify({[ids.seller]:receiver}),{mode:0o600});
 process.env.VEIL_DIGITAL_ROOT=root;process.env.VEIL_DIGITAL_SELLERS_FILE=sellers;process.env.VEIL_DIGITAL_PUBLISHING_ENABLED='1';process.env.VEIL_SQLITE_PATH=path;
 const signer=generateKeyPairSync('ed25519'),key=signer.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');
 const env={DB:d1Adapter(db),VEIL_DIGITAL_SELLERS:JSON.stringify({[ids.seller]:receiver}),VEIL_DIGITAL_PUBLISHING_ENABLED:'1',VEIL_DIGITAL_VERIFY:(id,user)=>verifyDraftFiles(db,id,user),VEIL_SCANNER_PUBLIC_KEY:key,VEIL_SCANNER_SERVICE_TOKEN_SHA256:'ab'.repeat(32)};
 Module._load=function(id,...args){if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>null};return realLoad.call(this,id,...args);};
 const service=require('../.sites-runtime/test-build/lib/veil/server.js'),queue=require('../.sites-runtime/test-build/lib/veil/payment-queue.js');
 async function start(){server=createServer((req,res)=>{auth(req,res,()=>handler(req,res,()=>{res.writeHead(404,{'Cache-Control':'no-store'});res.end();})).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;auth=authenticationHandler(db,origin,{allowLoopbackHttp:true});handler=digitalHandler(db,origin,{limits:testLimits});}
 async function stop(){if(server?.listening){server.closeAllConnections();await new Promise(r=>server.close(r));}}
 async function call(url,{as='seller',method='GET',body,headers={}}={}){return fetch(origin+url,{method,headers:{...(as?{Cookie:cookies[as]}:{}),...(method!=='GET'&&method!=='HEAD'?{Origin:origin}:{}),...headers},body,redirect:'manual'});}
 async function json(url,data,as='seller'){return call(url,{as,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
 async function upload(kind,bytes,format='png',as='seller',headers={}){return call('/api/digital/uploads?kind='+kind+'&format='+format,{as,method:'POST',headers:{'Content-Type':'application/octet-stream',...headers},body:bytes});}
 const testLimits={...LIMITS,reserve:0}; // Explicit temporary test root; production reserve is never relaxed.
 let auction,fileId,previewId,bidId,invoice,valid;
 const bytes=await sharp({create:{width:12,height:12,channels:4,background:'#e8b83b'}}).withMetadata({exif:{IFD0:{Artist:'PRIVATE ORIGINAL METADATA'}}}).png().toBuffer();
 const signed=r=>({report:r,signature:sign(null,reportMessage(r),signer.privateKey).toString('hex')});
 try{
  await start();
  await t.test('native upload authentication, CSRF, strict formats, streaming size and quota/reserve gates',async()=>{
   assert.equal((await upload('preview',bytes,'png',null)).status,401);
   assert.equal((await upload('preview',bytes,'png','seller',{Origin:'https://attacker.invalid'})).status,403);
   assert.equal((await upload('preview',bytes,'png','buyer')).status,403);
   assert.equal((await upload('../outside',bytes)).status,400);
   assert.equal((await upload('preview',Buffer.from('<script>not an image</script>'))).status,400);
   assert.equal((await upload('deliverable',bytes,'svg')).status,400);
   assert.equal((await upload('deliverable',bytes,'jpg')).status,400);
   assert.equal((await upload('deliverable',Buffer.alloc(LIMITS.file+1))).status,413);
   for(const limits of [{...testLimits,account:0},{...testLimits,total:0}]){handler=digitalHandler(db,origin,{limits});assert.equal((await upload('deliverable',bytes)).status,429);}
   handler=digitalHandler(db,origin,{limits:{...LIMITS,reserve:Number.MAX_SAFE_INTEGER}});assert.equal((await upload('deliverable',bytes)).status,507);handler=digitalHandler(db,origin,{limits:testLimits});
   assert.equal(db.prepare('SELECT COUNT(*) n FROM digital_assets').get().n,0);
   assert.deepEqual(await fs.readdir(join(root,'tmp')),[]);
  });
  await t.test('an interrupted stream releases its reservation and semaphore; a legitimate retry succeeds',async()=>{
   const req=httpRequest(origin+'/api/digital/uploads?kind=deliverable&format=png',{method:'POST',headers:{Cookie:cookies.seller,Origin:origin,'Content-Type':'application/octet-stream','Content-Length':String(bytes.length)}});req.on('error',()=>{});req.write(bytes.subarray(0,16));
   for(let i=0;i<100&&!db.prepare("SELECT 1 FROM digital_assets WHERE state='uploading'").get();i++)await new Promise(r=>setTimeout(r,10));
   assert.ok(db.prepare("SELECT 1 FROM digital_assets WHERE state='uploading'").get());assert.equal((await upload('deliverable',bytes)).status,429);req.destroy();
   for(let i=0;i<100&&db.prepare("SELECT 1 FROM digital_assets WHERE state='uploading'").get();i++)await new Promise(r=>setTimeout(r,10));
   assert.equal(db.prepare("SELECT COUNT(*) n FROM digital_assets WHERE state='uploading'").get().n,0);assert.deepEqual(await fs.readdir(join(root,'tmp')),[]);
   assert.equal((await upload('deliverable',bytes)).status,201);
  });
  await t.test('only a fully decoded still image or constrained binary STL is accepted; no path/header reflection',async()=>{
   const bad=Buffer.concat([bytes,Buffer.from('trailing executable material')]);assert.equal((await upload('deliverable',bad)).status,400);
   const stl=Buffer.alloc(134);stl.writeUInt32LE(1,80);const accepted=await upload('deliverable',stl,'stl');assert.equal(accepted.status,201);assert.equal((await accepted.json()).asset.format,'stl');
   stl.writeFloatLE(Infinity,84);assert.equal((await upload('deliverable',stl,'stl')).status,400);
   const p=await upload('preview',bytes,'png','seller',{'Content-Disposition':'attachment; filename="../../PRIVATE_NAME.png%0d%0aX-Bad:yes"'});assert.equal(p.status,201);const data=await p.json();previewId=data.asset.id;assert.match(previewId,/^[a-f0-9]{32}$/);assert.ok(!JSON.stringify(data).includes('PRIVATE_NAME'));assert.ok(!('sha256'in data.asset));
   const f=await upload('deliverable',bytes);assert.equal(f.status,201);fileId=(await f.json()).asset.id;
   const actual=await fs.readFile(join(root,'objects',fileId));assert.deepEqual(actual,bytes);
   const metadata=await sharp(join(root,'objects',previewId)).metadata();assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);
  });
  await t.test('draft ownership, category, provenance and receiver eligibility are server-enforced',async()=>{
   const draft={previewId,fileId,category:'Digital Art',license:'Personal display only; copyright remains with the seller.',edition:'',provenance:'Synthetic artwork generated by the test suite.'};
   assert.equal((await json('/api/digital/drafts',draft,'outsider')).status,403);
   assert.equal((await json('/api/digital/drafts',{...draft,category:'Physical'})).status,400);assert.equal((await json('/api/digital/drafts',{...draft,category:'Digital Collectibles',edition:''})).status,201);
   assert.equal((await json('/api/digital/drafts',{...draft,fileId:'../private'})).status,400);
   assert.equal((await json('/api/digital/drafts',{...draft,paid:true})).status,400);
   const response=await json('/api/digital/drafts',draft);assert.equal(response.status,201);const {draftId}=await response.json();
   const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
   const input={id:crypto.randomUUID(),title:'Synthetic digital test listing',description:'Test-only artwork; no real sale or payment.',sellerName:'Test studio',category:'Digital Art',artwork:'orbit',reserve:'10000',closesAt:Date.now()+120000,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey),paymentAddress:receiver,digitalDraftId:draftId};
   await assert.rejects(service.createAuction({...input,paymentAddress:receiver.slice(0,-1)+'x'},ids.seller));
   await assert.rejects(service.createAuction({...input,nftOwnershipVerified:true},ids.seller));
   await assert.rejects(service.createAuction({...input,paymentMode:'escrow-testnet'},ids.seller));
   await assert.rejects(service.createAuction(input,ids.outsider));
   auction=await service.createAuction(input,ids.seller);assert.equal(auction.digital.license,draft.license);
   assert.throws(()=>db.prepare("UPDATE digital_drafts SET license='replacement terms' WHERE id=?").run(draftId),/Frozen/);
   assert.throws(()=>db.prepare("UPDATE digital_assets SET sha256=? WHERE id=?").run('00'.repeat(32),fileId),/Frozen/);
   assert.throws(()=>db.prepare("UPDATE auctions SET category='Digital Items' WHERE id=?").run(auction.id),/Frozen/);
   assert.throws(()=>db.prepare('DELETE FROM digital_assets WHERE id=?').run(fileId));
   const outsider=await service.details(auction.id,ids.outsider);assert.equal(outsider.auction.paymentAddress,null);
   for(const secret of [receiver,createHash('sha256').update(bytes).digest('hex'),root,fileId])assert.ok(!JSON.stringify(outsider).includes(secret));
  });
  await t.test('seller access and no anonymous, outsider, loser, raw-path or browser-paid grants',async()=>{
   assert.equal((await call('/api/digital/download/'+auction.id,{as:null})).status,401);
   for(const as of ['buyer','loser','outsider'])assert.equal((await call('/api/digital/download/'+auction.id,{as})).status,403);
   assert.equal((await call('/objects/'+fileId)).status,404);
   assert.equal((await call('/api/digital/download/../../'+fileId)).status,404);
   assert.equal((await call('/api/digital/download/'+auction.id,{method:'POST',body:'{"paid":true}'})).status,405);
   const seller=await call('/api/digital/download/'+auction.id);assert.equal(seller.status,200);assert.deepEqual(Buffer.from(await seller.arrayBuffer()),bytes);assert.match(seller.headers.get('cache-control'),/private, no-store/);assert.equal(seller.headers.get('x-content-type-options'),'nosniff');assert.ok(!seller.headers.get('content-disposition').includes('PRIVATE'));
   assert.equal(db.prepare('SELECT COUNT(*) n FROM digital_entitlements').get().n,0);
  });
  await t.test('synthetic published result and queued scan do not grant; invalid/stale/mismatched signatures do not grant',async()=>{
   bidId=crypto.randomUUID();db.prepare('INSERT INTO bids(id,auction_id,bidder_id,commitment,ciphertext,ciphertext_hash,accepted_at) VALUES(?,?,?,?,?,?,?)').run(bidId,auction.id,ids.buyer,'ab'.repeat(32),'SYNTHETIC result fixture','cd'.repeat(32),Date.now());
   db.prepare('UPDATE auctions SET result=? WHERE id=?').run(JSON.stringify({winnerId:bidId,amount:'20000',status:'zk-verified',snapshotHash:'ab'.repeat(32),declaredAt:Date.now()}),auction.id);
   invoice=(await service.paymentStatus(auction.id,ids.buyer)).invoice;
   await queue.queuePaymentScan(auction.id,{txid:'bc'.repeat(32),output:0},ids.buyer);assert.equal(db.prepare('SELECT COUNT(*) n FROM digital_entitlements').get().n,0);
   const now=Date.now();valid={version:1,invoiceId:invoice.invoiceId,network:'testnet',txid:'bc'.repeat(32),output:0,pool:'sapling',address:receiver,amount:invoice.amount,memo:invoice.memo,status:'confirmed',blockHash:'de'.repeat(32),blockHeight:98,tipHeight:100,confirmations:3,observedAt:now,expiresAt:now+300000};
   for(const delta of [{amount:'1'},{memo:'wrong'},{network:'mainnet'},{invoiceId:'00'.repeat(32)},{expiresAt:now-1},{confirmations:2}])await assert.rejects(service.submitPaymentReport(auction.id,signed({...valid,...delta}),ids.buyer));
   const forged=signed(valid);forged.signature='00'.repeat(64);await assert.rejects(service.submitPaymentReport(auction.id,forged,ids.buyer));
   assert.equal(db.prepare('SELECT COUNT(*) n FROM digital_entitlements').get().n,0);
  });
  await t.test('report/grant transaction rolls back on a simulated grant failure; worker lost-ACK retry cannot duplicate the grant',async()=>{
   db.exec("CREATE TEMP TRIGGER crash_grant BEFORE INSERT ON digital_entitlements BEGIN SELECT RAISE(ABORT,'synthetic crash before grant');END;");
   await assert.rejects(service.submitPaymentReport(auction.id,signed(valid),ids.buyer));assert.equal(db.prepare('SELECT COUNT(*) n FROM payment_reports').get().n,0);db.exec('DROP TRIGGER crash_grant');
   const {job}=await queue.scannerExchange({action:'claim'});assert.ok(job);
   db.exec("CREATE TEMP TRIGGER crash_ack BEFORE UPDATE OF last_report_hash ON payment_scan_jobs BEGIN SELECT RAISE(ABORT,'synthetic lost ACK');END;");
   const payload={action:'report',jobId:job.id,leaseId:job.leaseId,signed:signed(valid)};await assert.rejects(queue.scannerExchange(payload));
   assert.equal(db.prepare('SELECT COUNT(*) n FROM digital_entitlements').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM payment_reports').get().n,1);db.exec('DROP TRIGGER crash_ack');
   assert.equal((await queue.scannerExchange(payload)).accepted,true);assert.equal((await queue.scannerExchange(payload)).accepted,true);
   assert.equal(db.prepare("SELECT COUNT(*) n FROM digital_events WHERE event='access-granted'").get().n,1);
   assert.equal(reviewableReport(signed(valid),db.prepare('SELECT * FROM digital_entitlements').get(),db.prepare('SELECT * FROM auctions WHERE id=?').get(auction.id),key),true);
  });
  await t.test('paid winner receives exact frozen bytes with safe HEAD/range behavior; others still denied',async()=>{
   const response=await call('/api/digital/download/'+auction.id,{as:'buyer'});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
   const head=await call('/api/digital/download/'+auction.id,{as:'buyer',method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal((await head.arrayBuffer()).byteLength,0);
   assert.equal((await call('/api/digital/download/'+auction.id,{as:'buyer',headers:{Range:'bytes=0-5'}})).status,416);
   assert.equal((await call('/api/digital/download/'+auction.id,{as:'outsider',headers:{Range:'bytes=0-5'}})).status,403);
   assert.equal((await service.details(auction.id,ids.buyer)).auction.paymentAddress,receiver);
  });
  await t.test('routine report expiry and real HTTP/database restart preserve the entitlement',async()=>{
   Date.now=()=>valid.expiresAt+1;try{assert.equal((await service.paymentStatus(auction.id,ids.buyer)).status,'needs-refresh');}finally{Date.now=realNow;}
   await stop();db.close();db=openDatabase(path);env.DB=d1Adapter(db);await start();
   const response=await call('/api/digital/download/'+auction.id,{as:'buyer'});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
   process.env.VEIL_DIGITAL_PUBLISHING_ENABLED='0';assert.equal((await upload('deliverable',bytes)).status,503);assert.equal((await call('/api/digital/download/'+auction.id,{as:'buyer'})).status,200);process.env.VEIL_DIGITAL_PUBLISHING_ENABLED='1';
  });
  await t.test('explicit fresh not-confirmed evidence suspends future downloads; subsequent confirmation needs operator review',async()=>{
   const observedAt=Date.now()+1;await service.submitPaymentReport(auction.id,signed({...valid,status:'not-confirmed',blockHash:null,blockHeight:null,confirmations:0,observedAt,expiresAt:observedAt+300000}),ids.buyer);
   assert.equal((await call('/api/digital/download/'+auction.id,{as:'buyer'})).status,409);assert.equal(db.prepare('SELECT state FROM digital_entitlements').get().state,'suspended');
   const again={...valid,observedAt:observedAt+1,expiresAt:observedAt+300001};await service.submitPaymentReport(auction.id,signed(again),ids.buyer);assert.equal(db.prepare('SELECT state FROM digital_entitlements').get().state,'suspended');
   await stop();db.close();
   const environment={...process.env,VEIL_SCANNER_PUBLIC_KEY:key},script=resolve('runtime/digital-admin.mjs');
   assert.notEqual(spawnSync(process.execPath,[script,'review-resume',auction.id],{env:environment,encoding:'utf8'}).status,0);
   assert.equal(spawnSync(process.execPath,[script,'review-resume',auction.id],{env:{...environment,VEIL_DIGITAL_REVIEW_CONFIRM:'I reviewed current chain evidence and the exact frozen purchase'},encoding:'utf8'}).status,0);
   db=openDatabase(path);env.DB=d1Adapter(db);await start();assert.equal((await call('/api/digital/download/'+auction.id,{as:'buyer'})).status,200);
  });
  await t.test('corrupt/missing originals and symlinks never produce a successful download; repair keeps the grant',async()=>{
   const file=join(root,'objects',fileId);await fs.writeFile(file,'corrupt');const state=await(await call('/api/digital/listing/'+auction.id,{as:'buyer'})).json();assert.equal(state.accessState,'unavailable');assert.equal(state.downloadAvailable,false);const bad=await call('/api/digital/download/'+auction.id,{as:'buyer'});assert.equal(bad.status,503);assert.ok(!(await bad.text()).includes(root));assert.equal(db.prepare('SELECT state FROM digital_entitlements').get().state,'active');
   await fs.unlink(file);assert.equal((await call('/api/digital/download/'+auction.id,{as:'buyer'})).status,503);
   if(process.platform!=='win32'){const outside=join(dir,'outside.txt');await fs.writeFile(outside,'SENSITIVE_NEVER_SERVE');await fs.symlink(outside,file);const r=await call('/api/digital/download/'+auction.id,{as:'buyer'});assert.equal(r.status,503);assert.ok(!(await r.text()).includes('SENSITIVE_NEVER_SERVE'));await fs.unlink(file);}
   await fs.writeFile(file,bytes,{mode:0o600});assert.equal((await call('/api/digital/download/'+auction.id,{as:'buyer'})).status,200);
  });
  await t.test('operator cleanup retains active/paid originals; a matched database-plus-files restore serves exact bytes',async()=>{
   await stop();db.close();const script=resolve('runtime/digital-admin.mjs');assert.equal(spawnSync(process.execPath,[script,'cleanup'],{env:process.env,encoding:'utf8'}).status,0);
   const backup=join(dir,'paired-backup');const result=spawnSync(process.execPath,[script,'backup',backup],{env:process.env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);const manifest=JSON.parse(await fs.readFile(join(backup,'complete.json'),'utf8'));assert.ok(manifest.files>=2);assert.equal(createHash('sha256').update(await fs.readFile(join(backup,'veil.sqlite'))).digest('hex'),manifest.databaseSha256);assert.deepEqual(await fs.readFile(join(backup,'objects',fileId)),bytes);
   const restoredRoot=join(dir,'restored-files'),restoredPath=join(dir,'restored.sqlite');await fs.mkdir(restoredRoot);await fs.cp(join(backup,'objects'),join(restoredRoot,'objects'),{recursive:true});await fs.copyFile(join(backup,'veil.sqlite'),restoredPath);
   process.env.VEIL_DIGITAL_ROOT=restoredRoot;process.env.VEIL_SQLITE_PATH=restoredPath;db=openDatabase(restoredPath);env.DB=d1Adapter(db);assert.equal(db.prepare('SELECT COUNT(*) n FROM digital_entitlements').get().n,1);await start();const response=await call('/api/digital/download/'+auction.id,{as:'buyer'});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  });
  await t.test('bounded protected-read throttling keeps preview traffic separate and recovers after its window',async()=>{
   handler=digitalHandler(db,origin,{limits:testLimits});
   for(let i=0;i<40;i++){assert.equal((await call('/api/digital/download/'+auction.id,{as:'buyer',method:'HEAD'})).status,200);await new Promise(r=>setTimeout(r,2));}
   const limited=await call('/api/digital/download/'+auction.id,{as:'buyer',method:'HEAD'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'30');
   assert.equal((await call('/api/digital/preview/'+auction.id,{as:'buyer'})).status,200);
   Date.now=()=>realNow()+600001;try{assert.equal((await call('/api/digital/download/'+auction.id,{as:'buyer',method:'HEAD'})).status,200);}finally{Date.now=realNow;}
  });
 }finally{
  Date.now=realNow;Module._load=realLoad;await stop();try{db.close();}catch{}for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);
  assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep)&&basename(dir).startsWith('veil-digital-test-'));await fs.rm(dir,{recursive:true,force:true});
 }
});
