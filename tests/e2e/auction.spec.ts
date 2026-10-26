import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const receiver=JSON.parse(readFileSync(new URL('../fixtures/synthetic-receiver.json',import.meta.url),'utf8')).address as string;
const UNLOCK=1692806364000;
test.beforeEach(async({page})=>{
 page.on('pageerror',e=>console.log('Browser error:',e.message));
 await page.exposeFunction('__veilTestNotice',(message:string)=>console.log('UI error:',message));
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
  let previous='';new MutationObserver(()=>{const text=document.querySelector('.toast.error')?.textContent||'';if(text&&text!==previous){previous=text;(window as unknown as {__veilTestNotice:(s:string)=>void}).__veilTestNotice(text);}}).observe(document.body,{childList:true,subtree:true,characterData:true});
 }));
});
async function prepared(page:Page){
 await Promise.race([page.getByText('LOCAL TALLY / NOT YET PUBLISHED').waitFor({timeout:150000}),page.locator('.toast.error').waitFor({timeout:150000}).then(async()=>{throw Error('Tally failed: '+await page.locator('.toast.error').textContent());})]);
}
async function ready(page:Page){await expect(page.locator('main[data-hydrated="true"]')).toBeVisible({timeout:60000});}
async function clock(page:Page,now:number){await page.request.post('/__veil/clock',{data:{now}});await page.clock.setFixedTime(new Date(now));}
async function identity(page:Page,as:string){await page.goto('/__veil/identity?as='+as);await ready(page);}
async function create(page:Page,reserve='1.20',paymentAddress?:string){
 await clock(page,UNLOCK-120001);await identity(page,'seller');
 await page.getByRole('button',{name:'Create auction',exact:true}).click();
 const title='Browser lot '+crypto.randomUUID().slice(0,8);
 await page.getByLabel('Lot title').fill(title);await page.getByLabel('Public seller name').fill('Test studio');
 await page.getByLabel('The story').fill('Fictional lot for deterministic browser testing.');
 await page.getByLabel('Reserve · test ZEC').fill(reserve);await page.getByLabel('Closes in').selectOption('2');
 // Receiver is assigned by the explicit fixture seller configuration, never a browser override.
 const fixture={name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('fixture bytes; native file validation is covered separately')};
 await expect(page.getByLabel(/Sapling testnet address/)).toHaveValue(receiver);
 await page.getByLabel(/Public preview/).setInputFiles(fixture);await expect(page.getByText('Sanitized preview ready.',{exact:true})).toBeVisible();
 await page.getByLabel(/Protected deliverable/).setInputFiles(fixture);await expect(page.getByText('Protected deliverable validated.',{exact:true})).toBeVisible();
 await page.getByLabel('License / usage terms').fill('Synthetic fixture: personal testing only, no goods exchanged.');
 await page.getByLabel('Provenance (seller-declared)').fill('Synthetic fixture by the test suite; no actual goods.');
 await page.getByRole('checkbox').check();
 const download=page.waitForEvent('download');const created=page.waitForResponse(r=>r.url().endsWith('/api/auctions')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Open the auction'}).click();
 const response=await created;expect(response.status()).toBe(201);
 const {auction}=await response.json();
 const backup=await download;const stream=await backup.createReadStream();let bytes='';for await(const chunk of stream!)bytes+=chunk;
 await expect(page.getByRole('dialog')).toBeVisible();return {auction,title,backup:bytes};
}
async function open(page:Page,title:string){await page.getByRole('button',{name:new RegExp(title)}).click();await expect(page.getByRole('dialog')).toBeVisible();}
async function bid(page:Page,title:string,who:string,amount:string){await identity(page,who);await open(page,title);await page.getByLabel('Your offer in ZEC').fill(amount);await page.getByRole('button',{name:'Seal my bid',exact:true}).click();await expect(page.getByText('Your offer is sealed.')).toBeVisible();}

test('local identity is explicit; supplied identity headers do not authenticate',async({page})=>{
 await page.goto('/');await ready(page);const unauth=await page.request.get('/api/auctions',{headers:{'oai-authenticated-user-id':'injected','oai-authenticated-user-email':'bad@test.invalid'}});expect(unauth.status()).toBe(401);
 await identity(page,'seller');expect((await page.request.get('/api/auctions')).ok()).toBeTruthy();
 expect((await page.request.get('/__veil/identity?as=administrator')).status()).toBe(400);
 expect((await page.request.get('/__veil/identity?as=seller',{headers:{origin:'https://attacker.invalid','sec-fetch-site':'cross-site'}})).status()).toBe(403);
 expect((await page.request.get('/api/auctions',{headers:{Host:'attacker.invalid'}})).status()).toBe(403);
});

for(const [amount,verdict] of [['2.50','Your offer won.'],['2.10','Your offer won.'],['1.80','A sample bidder won.']]){
 test('guided demo real Worker/WASM proof: '+amount,async({page})=>{
  await clock(page,UNLOCK-20000);await page.goto('/');await ready(page);await page.getByRole('button',{name:'Try the demo',exact:true}).click();
  await page.getByLabel('Demo bid in ZEC').fill(amount);await page.getByRole('button',{name:'Seal my bid',exact:true}).click();
  await expect(page.getByText('Unlocking in')).toBeVisible();await page.clock.setFixedTime(new Date(UNLOCK+100));
  await expect(page.getByRole('button',{name:'Open as seller'})).toBeEnabled();
  const start=Date.now();await page.getByRole('button',{name:'Open as seller'}).click();
  await expect(page.getByText(verdict,{exact:true})).toBeVisible({timeout:150000});
  console.log('Guided proof milliseconds',amount,Date.now()-start);
  await expect(page.getByText('Highest-bid proof generated and independently verified in this browser.',{exact:false})).toBeVisible();
 });
}

test('persisted tie, lost response, independent identities and payment follow-up',async({page,browser})=>{
 const participants:import('@playwright/test').BrowserContext[]=[];
 async function participant(as:string,now:number){const context=await browser.newContext({baseURL:'http://127.0.0.1:5174'});participants.push(context);const p=await context.newPage();await p.clock.setFixedTime(new Date(now));await identity(p,as);return p;}
 try{
 const {auction,title,backup}=await create(page,'1.20',receiver);
 const self=await page.request.post(`/api/auctions/${auction.id}/bids`,{data:{}});expect(self.status()).toBe(400); // invalid input never accepted
 await page.getByRole('button',{name:'Close dialog'}).click();
 const bidder=await participant('bidder-1',UNLOCK-120001),secondBidder=await participant('bidder-2',UNLOCK-120001);
 await bid(bidder,title,'bidder-1','2.50');await bid(secondBidder,title,'bidder-2','2.50');
 expect(await bidder.evaluate(id=>localStorage.getItem('veil:auction-key:'+id),auction.id)).toBeNull();
 await clock(page,UNLOCK+100);await identity(page,'seller');await open(page,title);
 await page.evaluate(id=>localStorage.removeItem('veil:auction-key:'+id),auction.id);
 await page.getByRole('button',{name:'Open all bids & prepare result'}).click();await expect(page.getByRole('status')).toContainText('Import your auction key');
 await page.locator('input[type=file]').setInputFiles({name:'wrong-key.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...JSON.parse(backup),auctionId:crypto.randomUUID()}))});
 await expect(page.getByRole('status')).toContainText('different auction');
 await page.locator('input[type=file]').setInputFiles({name:'restored-key.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await expect(page.getByRole('status')).toContainText('restored');
 await page.getByRole('button',{name:'Open all bids & prepare result'}).click();await prepared(page);
 let publicationWrites=0,hideResult=false;
 await page.route('**/api/auctions/'+auction.id,async route=>{if(hideResult)await route.abort('failed');else await route.continue();});
 await page.route('**/api/auctions/'+auction.id+'/result',async route=>{publicationWrites++;const response=await route.fetch();expect(response.ok()).toBeTruthy();hideResult=true;await route.abort('failed');});
 await page.getByRole('button',{name:'Publish this result'}).click();
 await expect(page.getByText('Publication unknown',{exact:true})).toBeVisible();expect(publicationWrites).toBe(1);
 hideResult=false;await page.getByRole('button',{name:'Check publication status'}).click();
 await expect(page.getByText('ZK-VERIFIED RESULT')).toBeVisible();expect(publicationWrites).toBe(1);
 const detail=await (await page.request.get(`/api/auctions/${auction.id}`)).json();expect(detail.auction.result.winnerId).toBe(detail.bids[0].id);
 const observer=await participant('observer',UNLOCK+100);await open(observer,title);await observer.getByRole('button',{name:'Result',exact:true}).click();
 await observer.getByRole('button',{name:'Verify highest-bid proof'}).click();await expect(observer.getByRole('status')).toContainText('Highest bid, reserve, and tie-break verified');
 expect((await observer.request.get(`/api/auctions/${auction.id}/payment`)).status()).toBe(403);
 expect((await observer.request.post(`/api/auctions/${auction.id}/bids`,{data:{id:crypto.randomUUID(),commitment:'01'.repeat(32),ciphertext:'invalid'}})).status()).toBe(409);
 await bidder.clock.setFixedTime(new Date(UNLOCK+100));await bidder.goto('/');await ready(bidder);await open(bidder,title);await bidder.getByRole('button',{name:'Result',exact:true}).click();
 await expect(bidder.getByRole('button',{name:'Download invoice',exact:true})).toBeVisible();
 await bidder.getByRole('button',{name:'Record that I sent payment'}).click();await expect(bidder.getByText('You reported sending payment (unverified)',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:'Record that I sent payment'})).toHaveCount(0);
 await clock(page,UNLOCK+86400101);await expect(page.getByRole('heading',{name:'Payment follow-up overdue'})).toBeVisible();
 await page.getByRole('button',{name:'Request direct discussion'}).click();await expect(page.getByText('You requested direct discussion',{exact:false})).toBeVisible();
 expect((await (await page.request.get(`/api/auctions/${auction.id}`)).json()).auction.result.winnerId).toBe(detail.bids[0].id);
 }finally{for(const context of participants)await context.close();}
});

for(const [label,reserve,offer] of [['no bids','1.20',null],['reserve unmet','10.00','2.50']] as const){
 test('persisted '+label+' uses a real no-winner proof',async({page})=>{
  const {title}=await create(page,reserve);if(offer)await bid(page,title,'bidder-3',offer);
  await clock(page,UNLOCK+100);await identity(page,'seller');await open(page,title);
  await page.getByRole('button',{name:'Open all bids & prepare result'}).click();await prepared(page);
  await expect(page.getByRole('heading',{name:'Reserve not met.'})).toBeVisible();await page.getByRole('button',{name:'Publish this result'}).click();await expect(page.getByText('ZK-VERIFIED RESULT')).toBeVisible();
 });
}

test('keyboard modal focus and mobile viewport layout',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await ready(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 const trigger=page.getByRole('button',{name:'Try the demo',exact:true});await trigger.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]'))).toBeTruthy();
 await page.screenshot({path:'.sites-runtime/e2e/mobile-dialog.png'});
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
});


test('real encrypted bid limits, self/late bids and malformed accepted-envelope blocking',async({page})=>{
 const {auction,title}=await create(page);const api='/api/auctions/'+auction.id;
 async function seal(){return page.evaluate(async auction=>{const path='/lib/veil/crypto.ts';const {sealBid}=await import(path);return sealBid(auction.id,auction.publicKey,auction.unlockRound,'250000000',auction.proofContext);},auction);}
 const first=await seal();expect((await page.request.post(api+'/bids',{data:first})).status()).toBe(403);
 await page.request.get('/__veil/identity?as=bidder-1');
 expect((await page.request.post(api+'/bids',{data:{...first,ciphertext:'x'.repeat(300)}})).status()).toBe(400);
 expect((await page.request.post(api+'/bids',{data:{...first,commitment:'01'.repeat(32)}})).status()).toBe(201);
 expect((await page.request.post(api+'/bids',{data:await seal()})).status()).toBe(409);
 for(let i=2;i<=8;i++){await page.request.get('/__veil/identity?as=bidder-'+i);expect((await page.request.post(api+'/bids',{data:await seal()})).status()).toBe(201);}
 await page.request.get('/__veil/identity?as=bidder-9');expect((await page.request.post(api+'/bids',{data:await seal()})).status()).toBe(409);
 await clock(page,UNLOCK+100);await identity(page,'seller');await open(page,title);
 await page.getByRole('button',{name:'Open all bids & prepare result'}).click();await expect(page.getByRole('status')).toContainText('Tally stopped');
 const detail=await (await page.request.get(api)).json();expect(detail.bids).toHaveLength(8);expect(detail.auction.result).toBeNull();
 const payload={winnerId:null,amount:null,salt:null,openedCount:8,snapshotHash:detail.snapshotHash};
 expect((await page.request.post(api+'/result',{data:payload})).status()).toBe(400);
 expect((await page.request.post(api+'/result',{data:{...payload,openedCount:7}})).status()).toBe(409);
});

test('cancelling a real proof worker restores the demo without a success state',async({page})=>{
 await clock(page,UNLOCK-20000);await page.goto('/');await ready(page);
 await page.getByRole('button',{name:'Try the demo',exact:true}).click();await page.getByRole('button',{name:'Seal my bid',exact:true}).click();await expect(page.getByText('Unlocking in')).toBeVisible();
 await page.clock.setFixedTime(new Date(UNLOCK+100));
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/runtime-0.js',async route=>{await gate;await route.abort().catch(()=>{});});
 await page.getByRole('button',{name:'Open as seller'}).click();await expect(page.getByRole('button',{name:'Cancel proof'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel proof'}).click();release();await expect(page.getByRole('button',{name:'Open as seller'})).toBeEnabled();
 await expect(page.getByText('Your offer won.',{exact:true})).toHaveCount(0);await expect(page.getByRole('status')).toContainText('cancelled');
});


test('seller receiver lookup survives edits while eligibility is pending',async({page})=>{
 await identity(page,'seller');
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/digital/config',async route=>{const response=await route.fetch();await gate;await route.fulfill({response});});
 await page.getByRole('button',{name:'Create auction',exact:true}).click();
 await page.getByLabel('Lot title').fill('Typing while coverage loads');
 await page.getByLabel('Public seller name').fill('Pending lookup studio');
 await expect(page.getByLabel(/Sapling testnet address/)).toHaveValue('');
 release();
 await page.getByLabel('The story').fill('Keep typed metadata while the server assigns this seller receiver.');
 await page.getByLabel('Reserve · test ZEC').fill('2.75');
 await expect(page.getByLabel(/Sapling testnet address/)).toHaveValue(receiver);
 await page.getByLabel('Lot title').fill('Typed title stays intact');
 await expect(page.getByLabel('Public seller name')).toHaveValue('Pending lookup studio');
 await expect(page.getByLabel('Reserve · test ZEC')).toHaveValue('2.75');
 await expect(page.getByLabel(/Sapling testnet address/)).toHaveValue(receiver);
 await expect(page.getByLabel(/Sapling testnet address/)).toHaveAttribute('readonly','');
});
