// One browser/proof at a time. Never imported by the website or wallet scanner.
import {PrivateState,privateDirectory} from './private-state.mjs';
export async function proveDemoJob(client,config,browser,job){
 const state=new PrivateState(await privateDirectory(config.journalRoot)),name=job.auctionId+'.json',saved=await state.read(name);if(!saved?.privateKey||saved.auctionId!==job.auctionId)throw Error('Missing retained demo recovery key; no result attempted.');
 const phase=p=>client.request('/api/judging/worker/phase',{id:job.id,token:job.token,phase:p});
 let context,stage='reconcile';
 try{
  const current=await client.request('/api/auctions/'+job.auctionId);
  if(current.auction.result?.status==='zk-verified'){await phase('verified');return 'reconciled';}
  if(saved.publicationRequested)throw Error('Uncertain publication: read-only reconciliation found no final result; operator review required.');
  stage='browser-session';context=await browser.newContext({baseURL:client.origin});
  // An exact host/path also supports the explicitly authorized loopback test origin.
  // Retain Secure and __Host semantics; never downgrade the native session cookie.
  await context.addCookies([{name:client.cookie.split('=')[0],value:client.cookie.slice(client.cookie.indexOf('=')+1),domain:new URL(client.origin).hostname,path:'/',secure:true,httpOnly:true,sameSite:'Strict'}]);
  const page=await context.newPage();await page.goto('/');await page.locator('main[data-hydrated="true"]').waitFor({timeout:90000});
  stage='restore-key';await page.evaluate(({id,key})=>localStorage.setItem('veil:auction-key:'+id,JSON.stringify(key)),{id:job.auctionId,key:saved.privateKey});
  await page.locator('[data-auction-id="'+job.auctionId+'"]').click();const open=page.getByRole('button',{name:'Open all bids & prepare result',exact:true});await open.waitFor({timeout:30000});
  // Ordinary clocks, unmodified drand gate, complete accepted log and actual prover.
  for(let i=0;i<30&&!await open.isEnabled();i++)await page.waitForTimeout(1000);if(!await open.isEnabled())throw Error('Future drand gate is not ready.');
  stage='prove';await open.click();await page.getByText('LOCAL TALLY / NOT YET PUBLISHED',{exact:true}).waitFor({timeout:1200000});
  await phase('publishing');saved.publicationRequested=true;await state.write(name,saved);
  stage='publish';await page.getByRole('button',{name:'Publish this result',exact:true}).click();
  await page.getByText('ZK-VERIFIED RESULT',{exact:true}).waitFor({timeout:90000});
  const final=await client.request('/api/auctions/'+job.auctionId);if(final.auction.result?.status!=='zk-verified'||final.bids.length!==current.bids.length||final.snapshotHash!==current.snapshotHash)throw Error('Published log mismatch.');
  await phase('verified');saved.phase='verified';await state.write(name,saved);return 'verified';
 }catch{saved.lastFailedStage=stage;await state.write(name,saved).catch(()=>{});console.error('Automatic demo stage failed: '+stage);await phase('failed').catch(()=>{});throw Error('Automatic demo reveal needs private operator review; bids and recovery keys are retained.');}
 finally{await context?.close();}
}
