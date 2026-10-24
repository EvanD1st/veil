// Actual production artifact, distinct password accounts and isolated browser contexts.
// Ordinary clocks and live future drand; no request interception, beacon fixture or mock identity.
import {chromium,expect} from '@playwright/test';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {initializeDatabase,openDatabase} from '../runtime/database.mjs';
import {createAccount} from '../runtime/accounts.mjs';
import {generateKeyPairSync,randomBytes,createHash} from 'node:crypto';
import {openOutbox,ScannerWorker,transport} from '../scanner/service.mjs';
const root=resolve('dist/standalone'),directory=await mkdtemp(join(tmpdir(),'veil-live-browser-')),path=join(directory,'private.sqlite');
initializeDatabase(path,join(root,'drizzle'));const db=openDatabase(path);
const observerId=await createAccount(db,'observer','ci-only-live-browser-password-observer');
db.close();const port=5187,origin='http://127.0.0.1:'+port;
const signer=generateKeyPairSync('ed25519'),serviceToken=randomBytes(32).toString('hex');
const receiver=JSON.parse(await readFile('tests/fixtures/synthetic-receiver.json','utf8')).address;
const child=spawn(process.execPath,[join(root,'runtime/server.mjs')],{cwd:root,env:{...process.env,VEIL_PUBLIC_ORIGIN:origin,VEIL_ALLOW_LOOPBACK_HTTP:'1',VEIL_ADMIN_ACCOUNT_IDS:observerId,VEIL_SQLITE_PATH:path,PORT:String(port),VEIL_SCANNER_PUBLIC_KEY:signer.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex'),VEIL_SCANNER_SERVICE_TOKEN_SHA256:createHash('sha256').update(serviceToken).digest('hex')},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
let browser;
try{
 let ready=false;for(let n=0;n<120;n++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Artifact startup failed: '+output);
 browser=await chromium.launch({headless:true});
 async function login(username){
  const registering=username!=='observer',context=await browser.newContext({baseURL:origin,acceptDownloads:true,...(username==='bidder'?{viewport:{width:390,height:844}}:{})}),page=await context.newPage();
  await page.goto('/');expect(new URL(page.url()).pathname).toBe('/login');
  if(username==='seller')await page.screenshot({path:'auth-login-desktop.png'});
  if(registering){await page.getByRole('link',{name:'Create account',exact:true}).click();if(username==='bidder'){await page.screenshot({path:'auth-signup-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}}
  await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill('ci-only-live-browser-password-'+username);
  if(registering){await page.getByLabel('Confirm password',{exact:true}).fill('mismatch-test-password');await page.getByRole('button',{name:'Create account',exact:true}).click();expect(new URL(page.url()).pathname).toBe('/signup');expect(await page.getByLabel('Confirm password',{exact:true}).evaluate(input=>input.validationMessage)).toBe('Passwords do not match.');await page.getByLabel('Confirm password',{exact:true}).fill('ci-only-live-browser-password-'+username);await page.getByRole('button',{name:'Show password',exact:true}).click();expect(await page.getByLabel('Password',{exact:true}).getAttribute('type')).toBe('text');await page.getByRole('button',{name:'Hide password',exact:true}).click();}
  await page.getByRole('button',{name:registering?'Create account':'Log in',exact:true}).click();await expect(page.locator('main[data-hydrated="true"]')).toBeVisible({timeout:30000});expect((await page.request.get('/api/auctions')).status()).toBe(200);const account=await page.request.get('/api/account');expect(account.status()).toBe(200);expect((await account.json()).username).toBe(username);await expect(page.locator('.account-greeting')).toContainText(username);await expect(page.getByRole('link',{name:'Log out',exact:true})).toBeVisible();
  await page.goto('/signup');expect(new URL(page.url()).pathname).toBe('/');return {page,context};
 }
 const seller=await login('seller'),bidder=await login('bidder'),observer=await login('observer');
 expect((await seller.page.request.get('/admin/accounts')).status()).toBe(403);expect((await bidder.page.request.get('/admin/accounts')).status()).toBe(403);
 await observer.page.goto('/admin/accounts');await expect(observer.page.getByRole('heading',{name:'Accounts',exact:true})).toBeVisible();await expect(observer.page.getByRole('cell',{name:'seller',exact:true})).toBeVisible();await expect(observer.page.getByRole('cell',{name:'bidder',exact:true})).toBeVisible();await observer.page.goto('/');
 expect((await browser.newContext().then(async c=>{const r=await c.request.get(origin+'/api/auctions',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@invalid.example'}});await c.close();return r.status();}))).toBe(401);
 const page=seller.page,title='Ordinary-clock CI auction';
 await page.getByRole('button',{name:'Create auction',exact:true}).click();await page.getByLabel('Lot title').fill(title);await page.getByLabel('Public seller name').fill('CI test studio');await page.getByLabel('The story').fill('Disposable separate-account integration check; no item or funds are exchanged.');await page.getByLabel('Reserve · test ZEC').fill('1.20');await page.getByLabel('Closes in').selectOption('2');await page.getByLabel(/Sapling testnet address/).fill(receiver);await page.getByRole('checkbox').check();
 const downloadPromise=page.waitForEvent('download'),createdPromise=page.waitForResponse(r=>r.url().endsWith('/api/auctions')&&r.request().method()==='POST');await page.getByRole('button',{name:'Open the auction'}).click();
 const created=await createdPromise;expect(created.status()).toBe(201);const {auction}=await created.json();const backup=await readFile(await (await downloadPromise).path(),'utf8');expect(JSON.parse(backup).auctionId).toBe(auction.id);
 await expect(page.getByRole('button',{name:'Bids are still sealed'})).toBeDisabled();expect((await page.request.post('/api/auctions/'+auction.id+'/bids',{data:{id:crypto.randomUUID(),commitment:'01'.repeat(32)}})).status()).toBe(403);
 await bidder.page.reload();await bidder.page.getByRole('button',{name:new RegExp(title)}).click();expect(await bidder.page.evaluate(id=>localStorage.getItem('veil:auction-key:'+id),auction.id)).toBeNull();
 await bidder.page.getByLabel('Your offer in ZEC').fill('2.50');await bidder.page.getByRole('button',{name:'Seal my bid',exact:true}).click();await expect(bidder.page.getByText('Your offer is sealed.')).toBeVisible({timeout:30000});
 expect((await bidder.page.request.get(`/api/auctions/${auction.id}/envelopes`)).status()).toBe(403);
 expect((await page.request.get(`/api/auctions/${auction.id}/envelopes`)).status()).toBe(409);
 await page.evaluate(id=>localStorage.removeItem('veil:auction-key:'+id),auction.id);
 await page.locator('input[type=file]').setInputFiles({name:'restored-key.json',mimeType:'application/json',buffer:Buffer.from(backup)});await expect(page.getByRole('status')).toContainText('restored');
 const open=page.getByRole('button',{name:'Open all bids & prepare result'});await expect(open).toBeEnabled({timeout:150000});
 const cold=Date.now();await open.click();await expect(page.getByText('LOCAL TALLY / NOT YET PUBLISHED')).toBeVisible({timeout:240000});console.log('Actual native cold proof elapsed ms:',Date.now()-cold);
 await page.getByRole('button',{name:'Overview',exact:true}).click();const cached=Date.now();await page.getByRole('button',{name:'Open all bids & prepare result'}).click();await expect(page.getByText('LOCAL TALLY / NOT YET PUBLISHED')).toBeVisible({timeout:180000});console.log('Actual native cached proof elapsed ms:',Date.now()-cached);
 await page.getByRole('button',{name:'Publish this result'}).click();await expect(page.getByText('ZK-VERIFIED RESULT')).toBeVisible({timeout:30000});
 await observer.page.reload();await observer.page.getByRole('button',{name:new RegExp(title)}).click();await observer.page.getByRole('button',{name:'Result',exact:true}).click();await observer.page.getByRole('button',{name:'Verify highest-bid proof'}).click();await expect(observer.page.getByRole('status')).toContainText('Highest bid, reserve, and tie-break verified',{timeout:30000});
 const detail=await (await observer.page.request.get(`/api/auctions/${auction.id}`)).json();expect(detail.auction.result.status).toBe('zk-verified');expect(detail.bids.length).toBe(1);
 // Synthetic payment selector and observation: actual signed worker/HTTP delivery, NOT wallet/payment evidence.
 const paymentPath=`/api/auctions/${auction.id}/payment`,selector={txid:'bc'.repeat(32),output:4};
 expect((await observer.page.request.get(paymentPath)).status()).toBe(403);
 expect((await observer.page.request.post(paymentPath+'/scan',{data:selector})).status()).toBe(403);
 expect((await bidder.page.request.post(paymentPath+'/scan',{data:selector})).status()).toBe(200);
 expect((await page.request.post('/api/scanner/jobs',{data:{action:'claim'}})).status()).toBe(401);
 const outbox=openOutbox(join(directory,'scanner-outbox.sqlite')),exchange=transport(origin,serviceToken,fetch,{allowLoopbackTest:true});
 try{
  const worker=new ScannerWorker({db:outbox,key:signer.privateKey,receiver,exchange,scan:async(invoice,txid,output)=>{const observedAt=Date.now();return {version:1,invoiceId:invoice.invoiceId,network:'testnet',txid,output,pool:'sapling',address:invoice.address,amount:invoice.amount,memo:invoice.memo,status:'not-confirmed',blockHash:null,blockHeight:null,tipHeight:100,confirmations:0,observedAt,expiresAt:observedAt+300000};}});
  expect(await worker.tick()).toBe('queued-delivery');const delivery=JSON.parse(outbox.prepare('SELECT payload FROM outbox').get().payload);expect(await worker.tick()).toBe('delivered');expect((await exchange(delivery)).accepted).toBe(true);
  const payment=await (await bidder.page.request.get(paymentPath)).json();expect(payment.status).toBe('not-confirmed');expect(payment.report.output).toBe(4);
  console.log('PASS synthetic-payment transport: authenticated participant queue, scoped worker delivery, trusted signature, duplicate ACK, outsider rejection. No actual RPC or payment claim.');
 }finally{outbox.close();}
 await page.getByRole('link',{name:'Log out',exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();expect(new URL(page.url()).pathname).toBe('/login');expect((await page.request.get('/api/auctions')).status()).toBe(401);expect((await page.request.get('/api/account')).status()).toBe(401);
 console.log('PASS production artifact: distinct real accounts, isolated contexts, persisted bid, key backup/restore, future live drand, cold/cached proof, publication and independent observer verification. No payment/device claim.');
}finally{await browser?.close();if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}}
