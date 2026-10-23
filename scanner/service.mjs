// Outbound HTTPS only. No listener and no remote wallet RPC interface.
import {DatabaseSync} from 'node:sqlite';
import {lstatSync,openSync,closeSync} from 'node:fs';
import {statfs,writeFile,rename} from 'node:fs/promises';
import {isAbsolute,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sign} from 'node:crypto';
import {scanInvoice,reportMessage} from './scan.mjs';
import {validateInvoice} from './invoice.mjs';
import {configuredClients,readSigningKey,readServiceToken} from './rpc.mjs';

export function openOutbox(path){
 if(!isAbsolute(path))throw Error('Use an absolute private outbox path.');
 try{const entry=lstatSync(path);if(!entry.isFile()||entry.isSymbolicLink()||(entry.mode&0o077))throw Error('Outbox must be an owner-only regular file.');}
 catch(error){if(error.code!=='ENOENT')throw error;closeSync(openSync(path,'wx',0o600));}
 const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,payload TEXT NOT NULL,expires_at INTEGER NOT NULL);');
 return db;
}
export function transport(origin,token,fetcher=fetch,{allowLoopbackTest=false}={}){
 const base=new URL(origin);
 if(base.username||base.password||base.pathname!=='/'||base.search||base.hash||!(base.protocol==='https:'||(allowLoopbackTest&&base.protocol==='http:'&&base.hostname==='127.0.0.1'))||!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid website origin or scanner service token.');
 return async payload=>{
  const response=await fetcher(new URL('/api/scanner/jobs',base),{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Website exchange unavailable.');
  const reader=response.body?.getReader();if(!reader)throw Error('Missing exchange body.');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();throw Error('Exchange body too large.');}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 };
}
export class ScannerWorker {
 constructor({db,exchange,walletRpc,chainRpc,key,receiver,now=Date.now,scan=scanInvoice}){Object.assign(this,{db,exchange,walletRpc,chainRpc,key,receiver,now,scan});}
 async tick(){
  const now=this.now();
  this.db.prepare('DELETE FROM outbox WHERE expires_at<=?').run(now);
  const pending=this.db.prepare('SELECT * FROM outbox ORDER BY expires_at LIMIT 1').get();
  if(pending){
   const accepted=await this.exchange(JSON.parse(pending.payload));
   if(accepted?.accepted!==true)throw Error('Report acknowledgement missing.');
   this.db.prepare('DELETE FROM outbox WHERE id=?').run(pending.id);
   return 'delivered';
  }
  const response=await this.exchange({action:'claim'}),job=response?.job;
  if(job===null)return 'idle';
  if(!job||typeof job.id!=='string'||typeof job.leaseId!=='string'||!Number.isSafeInteger(job.leaseUntil)||job.leaseUntil<=now||job.leaseUntil>now+630000)throw Error('Invalid job lease.');
  try{
   validateInvoice(job.invoice);
   if(job.invoice.address!==this.receiver)throw Error('Wrong receiver.');
   const report=await this.scan(job.invoice,job.txid,job.output,this.walletRpc,this.chainRpc,now);
   if(report.expiresAt<=this.now()+15000||job.leaseUntil<=this.now())throw Error('Observation too old for delivery.');
   const signed={report,signature:sign(null,reportMessage(report),this.key).toString('hex')};
   const payload={action:'report',jobId:job.id,leaseId:job.leaseId,signed};
   this.db.prepare('INSERT INTO outbox VALUES(?,?,?)').run(job.id,JSON.stringify(payload),report.expiresAt);
  }catch{
   // Never turn RPC failures, sync gaps or absent outputs into unsigned confirmation/revocation.
   await this.exchange({action:'unavailable',jobId:job.id,leaseId:job.leaseId});
   return 'unavailable';
  }
  return 'queued-delivery';
 }
}
async function main(){
 const env=process.env,path=env.VEIL_SCANNER_OUTBOX;
 if(!path||!env.VEIL_SCANNER_RECEIVER||!env.VEIL_WEBSITE_ORIGIN)throw Error('Missing scanner service configuration.');
 const db=openOutbox(path),key=await readSigningKey(),{walletRpc,chainRpc}=await configuredClients();
 const worker=new ScannerWorker({db,key,walletRpc,chainRpc,receiver:env.VEIL_SCANNER_RECEIVER,exchange:transport(env.VEIL_WEBSITE_ORIGIN,await readServiceToken())});
 let stopping=false,failures=0,wake;
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;wake?.();});
 try{while(!stopping){
  let state='unavailable',delay=15000;
  try{
   const space=await statfs(dirname(path));if(Number(space.bavail)*Number(space.bsize)<5*1024**3)throw Error('Disk reserve reached.');
   state=await worker.tick();failures=0;delay=state==='queued-delivery'?1000:15000;
  }catch{failures++;delay=Math.min(300000,15000*2**Math.min(failures-1,5));}
  const health=JSON.stringify({observedAt:Date.now(),state,consecutiveFailures:failures});
  const temporary=path+'.health.tmp';await writeFile(temporary,health,{mode:0o600});await rename(temporary,path+'.health.json');
  // Fixed labels only. No report, invoice, selector, response body, key or credential logs.
  console.log('Scanner service: '+state+'.');
  if(!stopping)await new Promise(resolve=>{const timer=setTimeout(resolve,delay);wake=()=>{clearTimeout(timer);resolve();};});
 }}finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Scanner service failed; inspect private configuration and service readiness.');process.exitCode=1;});
