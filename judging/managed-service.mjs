// Private loopback service; expose only through the authenticated SSH tunnel.
import {createServer} from 'node:http';
import {timingSafeEqual,randomInt,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Treasury} from './treasury.mjs';
import {ZingolibAdapter,privateJson} from './zingolib-adapter.mjs';
import {validateInvoice} from '../scanner/invoice.mjs';
const hex=/^[a-f0-9]{64}$/;
const PRIVATE_SELECTOR_URL='http://127.0.0.1:19070/api/judging/managed/selector';
export function createManagedSelectorDelivery({websiteOrigin,selectorUrl=PRIVATE_SELECTOR_URL,token,fetchImpl=fetch}){
 return async payload=>{
  if(websiteOrigin!=='https://ve-il.duckdns.org'||selectorUrl!==PRIVATE_SELECTOR_URL)throw Error('Private selector tunnel required.');
  const r=await fetchImpl(selectorUrl,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  if(!r.ok||(await r.json()).accepted!==true)throw Error('Selector acknowledgement unavailable.');
 };
}
export function createManagedService({db,adapter,policy,token,kill,now=Date.now,deliverSelector=async()=>{throw Error('Delivery unavailable');}}){
 if(!hex.test(token))throw Error('A separate private service token is required.');
 const treasury=new Treasury({db,adapter,policy,kill,now});
 db.exec('CREATE TABLE IF NOT EXISTS managed_backup_challenges(user TEXT PRIMARY KEY,positions TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);');
 // Startup is serialized by the service's OS lock. A crashed signer is never retried.
 db.exec("UPDATE judge_transfers SET state='prepare-unknown' WHERE state='preparing'");
 db.exec('CREATE TABLE IF NOT EXISTS managed_service_sessions(id TEXT PRIMARY KEY,opened_at INTEGER NOT NULL);');
 db.prepare('INSERT INTO managed_service_sessions VALUES(?,?)').run(randomUUID(),now());
 db.exec('DELETE FROM managed_service_sessions WHERE id NOT IN (SELECT id FROM managed_service_sessions ORDER BY opened_at DESC LIMIT 8)');
 let task=null,stopped=false;
 const wallet=user=>db.prepare('SELECT * FROM judge_private_wallets WHERE user=?').get(user);
 const work=fn=>{if(task)throw Error('Private wallet worker is busy.');task=Promise.resolve().then(fn).catch(()=>{}).finally(()=>{task=null;});};
 async function state(user){
  const w=wallet(user),balance=w?.wallet_account?adapter.cache?.get(w.wallet_account):null;
  const fresh=balance&&now()-balance.observedAt<120000;
  return {state:w?.state??'not-activated',network:'testnet',custody:'managed',address:w?.address??null,balanceZatoshis:fresh&&balance.synchronized?balance.confirmed:null,starterFunds:db.prepare("SELECT state FROM judge_transfers WHERE user=? AND kind='grant'").get(user)?.state??'not-requested',backupAvailable:!!w?.wallet_account,canPay:!!(w?.backup_confirmed&&fresh&&(adapter.validated||adapter.trialApproved)&&!kill()),reason:kill()?'Wallet operations are paused.':adapter.validated?'VEIL holds spending authority. Confirmed funds come from the synchronized testnet wallet.':adapter.trialApproved?'Isolated approved test transfers only; public funding is not active.':'Wallet recovery is available; funded signing and checkout validation is pending.'};
 }
 async function dispatch(action,user,input){
  if(typeof user!=='string'||user.length<1||user.length>200||!input||Array.isArray(input)||typeof input!=='object')throw Error('Invalid request.');
  if(adapter.trialApproved&&!adapter.validated&&!adapter.trialAllowsUser(user))throw Error('This isolated validation is limited to its approved test identities.');
  const fields=keys=>{if(Object.keys(input).some(k=>!keys.includes(k)))throw Error('Unexpected fields.');};
  if(action==='state'){fields([]);return state(user);}
  if(action==='activate'){fields([]);if(!wallet(user))work(()=>treasury.activate(user));return {state:wallet(user)?.state??'provisioning'};}
  if(action==='refresh'){fields([]);const w=treasury.wallet(user,false);work(()=>adapter.refresh(w.wallet_account));return {state:'refreshing'};}
  if(action==='backup'){
   fields([]);treasury.gate(false);const w=treasury.wallet(user,false);if(task)throw Error('Private wallet worker is busy.');
   // Random positions, attempt budget and expiry survive service restarts.
   const result=await adapter.backup(w.wallet_account),words=result.seed.split(/\s+/);
   const positions=[];while(positions.length<3){const n=randomInt(1,words.length+1);if(!positions.includes(n))positions.push(n);}
   db.prepare('INSERT INTO managed_backup_challenges(user,positions,expires,attempts) VALUES(?,?,?,0) ON CONFLICT(user) DO UPDATE SET positions=excluded.positions,expires=excluded.expires,attempts=0').run(user,JSON.stringify(positions),now()+600000);
   return {...result,positions,expiresAt:now()+600000};
  }
  if(action==='confirm-backup'){
   fields(['answers']);const c=db.prepare('SELECT * FROM managed_backup_challenges WHERE user=?').get(user);
   if(!c||c.expires<now()||c.attempts>=5||!Array.isArray(input.answers)||input.answers.length!==3||JSON.stringify(input.answers.map(a=>a?.index))!==c.positions)throw Error('Backup checkpoint expired or invalid.');
   db.prepare('UPDATE managed_backup_challenges SET attempts=attempts+1 WHERE user=?').run(user);
   await treasury.confirmBackup(user,input.answers);db.prepare('DELETE FROM managed_backup_challenges WHERE user=?').run(user);return state(user);
  }
  if(action==='fund'){fields([]);return treasury.requestGrant(user);}
  if(action==='quote'){fields(['invoice']);validateInvoice(input.invoice);return treasury.quote(user,input.invoice.auctionId,async()=>input.invoice);}
  if(action==='pay'){fields(['quoteId','affirmative','invoice']);validateInvoice(input.invoice);return treasury.pay(user,input.quoteId,input.affirmative,async()=>input.invoice);}
  if(action==='transfers'){fields([]);return {transfers:db.prepare("SELECT id,kind,state,invoice_id AS invoiceId,txid FROM judge_transfers WHERE user=? ORDER BY rowid DESC LIMIT 20").all(user)};}
  throw Error('Unsupported operation.');
 }
 async function tick(){
  if(stopped||task||kill())return;
  const outbox=db.prepare("SELECT * FROM judge_transfers WHERE kind='purchase' AND state IN ('broadcast-unknown','submitted','confirmed') AND txid IS NOT NULL AND sapling_output IS NOT NULL AND selector_ack=0 AND selector_next<=? LIMIT 1").get(now());
  if(outbox){work(async()=>{try{
   await deliverSelector({auctionId:outbox.memo.split(':')[1],invoiceId:outbox.invoice_id,user:outbox.user,txid:outbox.txid,output:outbox.sapling_output});
   db.prepare('UPDATE judge_transfers SET selector_ack=1 WHERE id=?').run(outbox.id);
  }catch{db.prepare('UPDATE judge_transfers SET selector_failures=selector_failures+1,selector_next=? WHERE id=?').run(now()+Math.min(300000,15000*2**Math.min(outbox.selector_failures,5)),outbox.id);}});return;}
  const interrupted=db.prepare("SELECT * FROM judge_private_wallets WHERE state='provisioning' AND wallet_account IS NULL LIMIT 1").get();
  if(interrupted){work(async()=>{try{const r=await adapter.provision({operation:interrupted.operation,user:interrupted.user});if(!r.independentAuthority)throw Error();db.prepare("UPDATE judge_private_wallets SET state='backup-required',wallet_account=?,address=? WHERE user=?").run(r.account,r.address,interrupted.user);}catch{db.prepare("UPDATE judge_private_wallets SET state='unavailable' WHERE user=?").run(interrupted.user);}});return;}
  const pending=db.prepare("SELECT id,state FROM judge_transfers WHERE state IN ('prepared','broadcast-unknown','submitted','queued') ORDER BY CASE state WHEN 'queued' THEN 1 ELSE 0 END,rowid LIMIT 20").all();
  if(pending.length&&(adapter.validated||adapter.trialApproved)){work(async()=>{
   for(const r of pending){if(kill())break;if(r.state==='queued'){await treasury.prepare(r.id);break;}else if(r.state==='prepared'){await treasury.broadcast(r.id);break;}else await treasury.reconcile(r.id);}
  });return;}
  const confirmed=db.prepare("SELECT id FROM judge_transfers WHERE state='confirmed' AND reconcile_next<=? ORDER BY reconcile_next LIMIT 1").get(now());
  if(confirmed&&adapter.validated){db.prepare('UPDATE judge_transfers SET reconcile_next=? WHERE id=?').run(now()+60000,confirmed.id);work(()=>treasury.reconcile(confirmed.id));return;}
  const w=db.prepare("SELECT wallet_account FROM judge_private_wallets WHERE wallet_account IS NOT NULL AND state IN ('ready','backup-required') ORDER BY rowid LIMIT 50").all().find(w=>now()-(adapter.cache?.get(w.wallet_account)?.observedAt??0)>60000);
  if(w)work(()=>adapter.refresh(w.wallet_account));
 }
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 const server=createServer(async(req,res)=>{
  try{
   const auth=req.headers.authorization??'',expected='Bearer '+token;
   if(auth.length!==expected.length||!timingSafeEqual(Buffer.from(auth),Buffer.from(expected)))return send(res,401,{error:'Unauthorized'});
   if(req.url!=='/v1'||req.method!=='POST'||req.headers['content-type']!=='application/json')return send(res,404,{error:'Unavailable'});
   let size=0,parts=[];for await(const c of req){size+=c.length;if(size>8192)throw Error();parts.push(c);}
   const body=JSON.parse(Buffer.concat(parts).toString('utf8'));
   if(Object.keys(body).sort().join()!=='action,input,user')throw Error();
   send(res,200,await dispatch(body.action,body.user,body.input));
  }catch{if(!res.headersSent)send(res,503,{error:'Wallet operation unavailable; retained state must be checked before retry.'});}
 });
 server.maxConnections=8;server.requestTimeout=20000;server.headersTimeout=10000;
 const timer=setInterval(()=>tick().catch(()=>{}),5000);timer.unref();
 return {server,dispatch,treasury,tick,state,close:()=>{stopped=true;clearInterval(timer);server.close();},idle:()=>task??Promise.resolve()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.umask(0o077);
 const config=privateJson(process.argv[2]);
 const adapter=new ZingolibAdapter(config),db=new DatabaseSync(config.database);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
 const kill=()=>config.enabled!==true||existsSync(config.killFile);
 const deliverSelector=createManagedSelectorDelivery(config);
 const app=createManagedService({db,adapter,policy:config.policy,token:config.token,kill,deliverSelector});
 app.server.listen(19070,'127.0.0.1');
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{app.close();setTimeout(()=>process.exit(0),1000).unref();});
}
