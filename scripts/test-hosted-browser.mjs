// Real hosted accounts/ordinary clocks/live drand. No payment, RPC, fixture or identity interception.
// Input must be an owner-only JSON file outside the repository; never log its contents.
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
const input=process.env.VEIL_HOSTED_TEST_CONFIG;
if(!input||!isAbsolute(input))throw Error('Use a private absolute configuration path.');
const stat=await lstat(input);if(!stat.isFile()||stat.isSymbolicLink()||(process.platform!=='win32'&&(stat.mode&0o077)))throw Error('Private configuration permissions required.');
const credentials=JSON.parse(await readFile(input,'utf8')),origin=credentials.origin,receiver=credentials.receiver;
if(new URL(origin).protocol!=='https:')throw Error('Hosted test requires HTTPS.');
const privateOutput=resolve(credentials.privateOutput);await mkdir(privateOutput,{recursive:true,mode:0o700});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.VEIL_BROWSER_CHANNEL?{channel:process.env.VEIL_BROWSER_CHANNEL}:{})});
 async function login(username){const context=await browser.newContext({baseURL:origin,acceptDownloads:true});const page=await context.newPage();page.on('pageerror',()=>console.log('Hosted browser script error in',username,'session.'));await page.goto('/signin-with-chatgpt');await page.getByLabel('Username').fill(credentials.accounts[username].username);await page.getByLabel('Password',{exact:true}).fill(credentials.accounts[username].password);await page.getByRole('button',{name:/^(Log in|Sign in)$/,exact:true}).click();await expect(page.locator('main[data-hydrated="true"]')).toBeVisible({timeout:90000});expect((await page.request.get('/api/auctions')).status()).toBe(200);return {page,context};}
 const seller=await login('seller'),bidder=await login('bidder'),observer=await login('observer');
 expect((await browser.newContext().then(async c=>{const r=await c.request.get(origin+'/api/auctions',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@invalid.example'}});await c.close();return r.status();}))).toBe(401);
 let auction,backup,title;const page=seller.page;
 if(credentials.resumeAuctionId){
  const saved=await (await page.request.get('/api/auctions/'+credentials.resumeAuctionId)).json();auction=saved.auction;title=auction.title;backup=await readFile(resolve(privateOutput,'seller-key-backup-'+auction.id+'.json'),'utf8');await page.getByRole('button',{name:new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();console.log('Resuming existing hosted auction; no replacement listing or bid.');
 }else{title='Hosted testnet validation '+new Date().toISOString();
 await page.getByRole('button',{name:'Create auction',exact:true}).click();await page.getByLabel('Lot title').fill(title);await page.getByLabel('Public seller name').fill('VEIL testnet validation');await page.getByLabel('The story').fill('Disposable separate-account integration check; no item or funds are exchanged.');await page.getByLabel('Reserve · test ZEC').fill('0.0001');await page.getByLabel('Closes in').selectOption('2');await page.getByLabel(/Sapling testnet address/).fill(receiver);await page.getByRole('checkbox').check();
 const downloadPromise=page.waitForEvent('download'),createdPromise=page.waitForResponse(r=>r.url().endsWith('/api/auctions')&&r.request().method()==='POST');await page.getByRole('button',{name:'Open the auction'}).click();
 const created=await createdPromise;expect(created.status()).toBe(201);({auction}=await created.json());backup=await readFile(await (await downloadPromise).path(),'utf8');expect(JSON.parse(backup).auctionId).toBe(auction.id);
 await writeFile(resolve(privateOutput,'seller-key-backup-'+auction.id+'.json'),backup,{mode:0o600,flag:'wx'});
 console.log('Hosted auction created; private key backup saved.');
 await expect(page.getByRole('button',{name:'Bids are still sealed'})).toBeDisabled();
 await bidder.page.reload();await bidder.page.getByRole('button',{name:new RegExp(title)}).click();expect(await bidder.page.evaluate(id=>localStorage.getItem('veil:auction-key:'+id),auction.id)).toBeNull();
 await bidder.page.getByLabel('Your offer in ZEC').fill('0.0002');await bidder.page.getByRole('button',{name:'Seal my bid',exact:true}).click();await expect(bidder.page.getByText('Your offer is sealed.')).toBeVisible({timeout:30000});
 expect((await bidder.page.request.get(`/api/auctions/${auction.id}/envelopes`)).status()).toBe(403);
 expect((await page.request.get(`/api/auctions/${auction.id}/envelopes`)).status()).toBe(409);
 }
 await page.evaluate(id=>localStorage.removeItem('veil:auction-key:'+id),auction.id);
 await page.locator('input[type=file]').setInputFiles({name:'restored-key.json',mimeType:'application/json',buffer:Buffer.from(backup)});await expect(page.getByRole('status')).toContainText('restored');
 const open=page.getByRole('button',{name:'Open all bids & prepare result'});await expect(open).toBeEnabled({timeout:150000});
 const cold=Date.now();console.log('Starting hosted cold proof.');await open.click();await expect(page.getByText('LOCAL TALLY / NOT YET PUBLISHED')).toBeVisible({timeout:1600000});console.log('Hosted cold proof elapsed ms:',Date.now()-cold);
 await page.getByRole('button',{name:'Overview',exact:true}).click();const cached=Date.now();await page.getByRole('button',{name:'Open all bids & prepare result'}).click();await expect(page.getByText('LOCAL TALLY / NOT YET PUBLISHED')).toBeVisible({timeout:180000});console.log('Hosted cached proof elapsed ms:',Date.now()-cached);
 await page.getByRole('button',{name:'Publish this result'}).click();await expect(page.getByText('ZK-VERIFIED RESULT')).toBeVisible({timeout:30000});
 await observer.page.reload();await observer.page.getByRole('button',{name:new RegExp(title)}).click();await observer.page.getByRole('button',{name:'Result',exact:true}).click();await observer.page.getByRole('button',{name:'Verify highest-bid proof'}).click();await expect(observer.page.getByRole('status')).toContainText('Highest bid, reserve, and tie-break verified',{timeout:30000});
 const detail=await (await observer.page.request.get(`/api/auctions/${auction.id}`)).json();expect(detail.auction.result.status).toBe('zk-verified');expect(detail.bids.length).toBe(1);

 const paymentPath=`/api/auctions/${auction.id}/payment`;
 expect((await observer.page.request.get(paymentPath)).status()).toBe(403);
 expect((await observer.page.request.post(paymentPath+'/scan',{data:{txid:'ab'.repeat(32),output:0}})).status()).toBe(403);
 expect((await page.request.post('/api/scanner/jobs',{data:{action:'claim'}})).status()).toBe(401);
 const invoice=await (await bidder.page.request.get(paymentPath)).json();
 await writeFile(resolve(privateOutput,'invoice.json'),JSON.stringify(invoice.invoice),{mode:0o600});
 await writeFile(resolve(privateOutput,'seller-key-backup.json'),backup,{mode:0o600});
 await page.goto('/signout-with-chatgpt');
 // Logout is checked below using the app's explicit CSRF-protected form.
 const logout=page.getByRole('button',{name:/sign out/i});if(await logout.count())await logout.click();
 expect((await page.request.get('/api/auctions')).status()).toBe(401);
 console.log('PASS hosted accounts, persisted auction, bid, key restore, real future drand, proof publication, independent verification and payment privacy. No transfer performed.');
}catch(error){
 await writeFile(resolve(privateOutput,'last-check-failure.txt'),String(error?.message??error),{mode:0o600});
 console.error('Hosted check did not complete; diagnostics saved privately. No payment performed.');process.exitCode=1;
}finally{await browser?.close();}
