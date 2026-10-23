// Actual production artifact, distinct password accounts and isolated browser contexts.
// Ordinary clocks and live future drand; no request interception, beacon fixture or mock identity.
import {chromium,expect} from '@playwright/test';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {initializeDatabase,openDatabase} from '../runtime/database.mjs';
import {createAccount} from '../runtime/accounts.mjs';
const root=resolve('dist/standalone'),directory=await mkdtemp(join(tmpdir(),'veil-live-browser-')),path=join(directory,'private.sqlite');
initializeDatabase(path,join(root,'drizzle'));const db=openDatabase(path);
for(const username of ['seller','bidder','observer'])await createAccount(db,username,'ci-only-live-browser-password-'+username);
db.close();const port=5187,origin='http://127.0.0.1:'+port;
const child=spawn(process.execPath,[join(root,'runtime/server.mjs')],{cwd:root,env:{...process.env,VEIL_PUBLIC_ORIGIN:origin,VEIL_ALLOW_LOOPBACK_HTTP:'1',VEIL_SQLITE_PATH:path,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
let browser;
try{
 let ready=false;for(let n=0;n<120;n++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Artifact startup failed: '+output);
 browser=await chromium.launch({headless:true});
 async function login(username){const context=await browser.newContext({baseURL:origin,acceptDownloads:true});const page=await context.newPage();await page.goto('/signin-with-chatgpt');await page.getByLabel('Username').fill(username);await page.getByLabel('Password',{exact:true}).fill('ci-only-live-browser-password-'+username);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('main[data-hydrated="true"]')).toBeVisible({timeout:30000});expect((await page.request.get('/api/auctions')).status()).toBe(200);return {page,context};}
 const seller=await login('seller'),bidder=await login('bidder'),observer=await login('observer');
 expect((await browser.newContext().then(async c=>{const r=await c.request.get(origin+'/api/auctions',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@invalid.example'}});await c.close();return r.status();}))).toBe(401);
 const page=seller.page,title='Ordinary-clock CI auction';
 await page.getByRole('button',{name:'Create auction',exact:true}).click();await page.getByLabel('Lot title').fill(title);await page.getByLabel('Public seller name').fill('CI test studio');await page.getByLabel('The story').fill('Disposable separate-account integration check; no item or funds are exchanged.');await page.getByLabel('Reserve · test ZEC').fill('1.20');await page.getByLabel('Closes in').selectOption('2');await page.getByRole('checkbox').check();
 const downloadPromise=page.waitForEvent('download'),createdPromise=page.waitForResponse(r=>r.url().endsWith('/api/auctions')&&r.request().method()==='POST');await page.getByRole('button',{name:'Open the auction'}).click();
 const created=await createdPromise;expect(created.status()).toBe(201);const {auction}=await created.json();const backup=await readFile(await (await downloadPromise).path(),'utf8');expect(JSON.parse(backup).auctionId).toBe(auction.id);
 await expect(page.getByRole('button',{name:'Bids are still sealed'})).toBeDisabled();
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
 console.log('PASS production artifact: distinct real accounts, isolated contexts, persisted bid, key backup/restore, future live drand, cold/cached proof, publication and independent observer verification. No payment/device claim.');
}finally{await browser?.close();if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}}
