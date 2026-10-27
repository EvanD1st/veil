// Runs only on the private wallet host. stdout/stderr from the SDK never enter logs.
import {execFile} from 'node:child_process';
import {readFileSync,lstatSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
// systemd exposes unit credentials as 0440 for the service identity; allow
// that mode only for this exact capability file inside the private credential dir.
export function privateJson(path){
 const s=lstatSync(path),mode=s.mode&0o777,credentialDir=process.env.CREDENTIALS_DIRECTORY&&resolve(process.env.CREDENTIALS_DIRECTORY);
 const isSystemdCapability=credentialDir&&resolve(path)===resolve(credentialDir,'managed-validation')&&(mode===0o400||mode===0o440),ownerOnly=(s.mode&0o077)===0;
 if(!s.isFile()||s.isSymbolicLink()||(!ownerOnly&&!isSystemdCapability)||s.size>65536)throw Error('Private configuration required.');
 return JSON.parse(readFileSync(path,'utf8'));
}
export class ZingolibAdapter{
 constructor(config){
  this.config=config;this.evidence='live-zingolib-testnet';this.running=false;this.cache=new Map();
  const binaryHash=createHash('sha256').update(readFileSync(config.binary)).digest('hex');
  if(binaryHash!==config.binarySha256)throw Error('Signing binary hash mismatch.');
  const p=lstatSync(config.walletRoot);if(!p.isDirectory()||p.isSymbolicLink()||(p.mode&0o077))throw Error('Private wallet directory required.');
  // Root-owned approval evidence is generated only after the isolated funded trial.
  this.validated=false;
  if(config.validationFile){const v=privateJson(config.validationFile);this.validated=v.network==='testnet'&&v.binarySha256===binaryHash&&['fundedRestore','preparedInspection','singleBroadcast','scannerConfirmed','restartReconciled'].every(k=>v[k]===true);}
  this.approval=config.trialApprovalFile?privateJson(config.trialApprovalFile):null;
 }
 get trialApproved(){const a=this.approval;return !!(a?.network==='testnet'&&a.binarySha256===this.config.binarySha256&&Number.isSafeInteger(a.expiresAt)&&Date.now()<a.expiresAt&&Array.isArray(a.transfers)&&a.transfers.length>0&&a.transfers.length<=20);}
 trialAllowsUser(user){return this.trialApproved&&this.approval.transfers.some(t=>t.user===user);}
 authorize(row){
  if(this.validated)return;
  if(!this.trialApproved||!this.approval.transfers.some(t=>t.kind===row.kind&&t.user===row.user&&t.source===row.source&&t.destination===row.destination&&t.amount===row.amount&&t.memo===row.memo&&t.invoiceId===(row.invoice_id??null)&&/^[1-9][0-9]{0,13}$/.test(t.maxFee??'')&&BigInt(row.max_fee)<=BigInt(t.maxFee)))throw Error('This exact test transfer has no current approval.');
 }
 async rpc(method,params=[]){
  if(!['getblockchaininfo','getrawtransaction','getblockhash','sendrawtransaction'].includes(method))throw Error('Unsupported node operation.');
  const credential=this.config.nodeCookieFile??join(process.env.CREDENTIALS_DIRECTORY??'/missing','node-cookie');
  const cookie=readFileSync(credential,'utf8').trim();if(!cookie.includes(':')||cookie.includes('\n'))throw Error('Invalid node credential.');
  const response=await fetch('http://127.0.0.1:18232',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(cookie).toString('base64')},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
  const raw=await response.text();if(raw.length>8*1024*1024)throw Error('Node response too large.');const r=JSON.parse(raw);
  if(!response.ok||r.error)throw Error('Node operation unavailable.');return r.result;
 }
 async readiness(){
  const h=JSON.parse(readFileSync(this.config.healthFile,'utf8')),age=Date.now()-h.observedAt;
  if(h.ready!==true||age<0||age>600000||h.stale===true||h.memAvailableBytes<2684354560||h.diskFreeBytes<15*1024**3)throw Error('Strict scanner readiness and resource reserve required.');
  const info=await this.rpc('getblockchaininfo');if(info.chain!=='test'||info.initialblockdownload===true||info.consensus?.chaintip!=='77190ad9')throw Error('Current testnet readiness required.');
  return info.blocks;
 }
 // execFile has no input option: explicitly pipe bounded JSON to the spawned SDK.
 async invoke(mode,account,input={}){
  if(!ID.test(account)||this.running)throw Error('Wallet busy or invalid account.');
  this.running=true;
  try{
   const height=await this.readiness();
   return await new Promise((resolve,reject)=>{
    const child=execFile(this.config.binary,[mode,join(this.config.walletRoot,account),String(height)],{timeout:420000,maxBuffer:8*1024*1024,encoding:'utf8'},(error,stdout)=>{
     if(error)return reject(Error('Wallet operation uncertain; private state retained.'));
     try{resolve(JSON.parse(stdout));}catch{reject(Error('Invalid wallet response.'));}
    });
    const guard=setInterval(()=>{try{const mem=readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m);if(!mem||Number(mem[1])*1024<1024**3)child.kill('SIGTERM');}catch{child.kill('SIGTERM');}},5000);guard.unref();child.once('exit',()=>clearInterval(guard));
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(input));
   });
  }finally{this.running=false;}
 }
 async provision({operation}){
  if(!ID.test(operation)||operation===this.config.policy.treasuryAccount)throw Error('Invalid or reserved allocation.');
  const path=join(this.config.walletRoot,operation),result=await this.invoke(existsSync(path)?'status':'provision',operation);
  this.cache.set(operation,{...result,observedAt:Date.now()});
  return {account:operation,address:result.address,independentAuthority:result.independentRecovery===true};
 }
 async refresh(account){const r=await this.invoke('status',account);this.cache.set(account,{...r,observedAt:Date.now()});return r;}
 async backup(account){return this.invoke('backup',account);}
 async confirmIndividualBackup(account,answers){return (await this.invoke('check-backup',account,{answers})).confirmed===true;}
 async balance(account){const r=this.cache.get(account);if(!r||Date.now()-r.observedAt>120000)throw Error('Balance is stale; refresh pending.');return {...r,account};}
 async prepare(row){return this.invoke('prepare',row.source,row);}
 async inspect(row){return this.invoke('inspect',row.source,{...row,txid:row.txid});}
 async broadcast(raw){
  // Called only with the exact immutable bytes in the durable transfer journal.
  if(!/^(?:[a-f0-9]{2}){1,2000000}$/.test(raw))throw Error('Invalid retained bytes.');
  return this.rpc('sendrawtransaction',[raw]);
 }
 async lookup(txid){
  if(!/^[a-f0-9]{64}$/.test(txid))throw Error('Invalid retained identity.');
  try{const r=await this.rpc('getrawtransaction',[txid,1]);if(!r.blockhash||!Number.isSafeInteger(r.confirmations)||r.confirmations<1)return null;
   const tip=await this.rpc('getblockchaininfo'),height=tip.blocks-r.confirmations+1;
   if(await this.rpc('getblockhash',[height])!==r.blockhash)return null;
   return {network:'testnet',txid,activeChain:true,confirmations:r.confirmations};
  }catch{return null;}
 }
}
