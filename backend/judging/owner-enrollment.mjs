// Operator-only wallet-host tool. No website route, listener, signing or spending.
import {execFile} from 'node:child_process';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {privateJson,privateDirectory,PrivateState} from './private-state.mjs';
import {isSaplingTestnet} from '../scanner/invoice.mjs';
import {checkReadiness} from '../scanner/scan.mjs';
import {configuredClients} from '../scanner/rpc.mjs';
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const digest=v=>createHash('sha256').update(v).digest('hex');
export function importViewingKeyRpc(env,fetchImpl=fetch){
 const url=new URL(env.ZALLET_RPC_URL);
 if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!isAbsolute(env.ZALLET_COOKIE_FILE??''))throw Error('Private local receiving-wallet RPC required.');
 return async(key,birthday)=>{
  const st=await lstat(env.ZALLET_COOKIE_FILE);if(!st.isFile()||st.isSymbolicLink()||st.size>4096||(process.platform!=='win32'&&(st.mode&0o077)))throw Error('Private receiving-wallet cookie required.');
  const auth=(await readFile(env.ZALLET_COOKIE_FILE,'utf8')).trim();if(!/^[^:\r\n]+:[^\r\n]+$/.test(auth))throw Error('Private receiving-wallet authentication required.');
  try{
   const r=await fetchImpl(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(auth).toString('base64')},body:JSON.stringify({jsonrpc:'2.0',id:'seller-import',method:'z_importviewingkey',params:[key,'whenkeyisnew',birthday]}),signal:AbortSignal.timeout(30000)});
   const text=await r.text();if(!r.ok||text.length>4096)throw Error();const value=JSON.parse(text);
   if(value.id!=='seller-import'||value.error||value.result?.address_type!=='sapling'||!isSaplingTestnet(value.result.address))throw Error();
   return value.result;
  }catch{throw Error('Viewing-key import is uncertain; retain its journal and reconcile the same key.');}
 };
}
// This is a coverage probe, not a new invoice or signed payment report.
export async function verifyIncomingCoverage(receipt,address,walletRpc,chainRpc){
 const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 if(!receipt||!hash(receipt.txid)||receipt.destination!==address||!isSaplingTestnet(address)||!Number.isSafeInteger(receipt.sapling_output)||receipt.sapling_output<0||typeof receipt.amount!=='string'||!/^\d+$/.test(receipt.amount)||BigInt(receipt.amount)<=0n||typeof receipt.memo!=='string'||Buffer.byteLength(receipt.memo)>512)throw Error('Exact retained incoming receipt required.');
 const chain=await checkReadiness(walletRpc,chainRpc),tx=await walletRpc('z_viewtransaction',[receipt.txid]);
 if(tx?.txid!==receipt.txid||tx.status!=='mined'||!hash(tx.blockhash)||!Array.isArray(tx.outputs))return false;
 const notes=tx.outputs.filter(n=>n?.pool==='sapling'&&n.output===receipt.sapling_output),note=notes[0];
 if(notes.length!==1||note.outgoing!==false||note.walletInternal!==false||note.address!==address||!Number.isSafeInteger(note.valueZat)||String(note.valueZat)!==receipt.amount||typeof note.memo!=='string'||note.memo.toLowerCase()!==Buffer.from(receipt.memo).toString('hex').padEnd(1024,'0'))return false;
 const block=await chainRpc('getblock',[tx.blockhash,1]);
 if(!Number.isSafeInteger(block?.height)||block.height<0||block.height>chain.blocks||block.hash!==tx.blockhash||!Array.isArray(block.tx)||!block.tx.includes(receipt.txid))return false;
 const confirmations=chain.blocks-block.height+1;
 if(confirmations<3||tx.confirmations!==confirmations||block.confirmations!==confirmations||await chainRpc('getblockhash',[block.height])!==tx.blockhash)return false;
 const final=await checkReadiness(walletRpc,chainRpc);
 return final.blocks===chain.blocks&&final.bestblockhash===chain.bestblockhash;
}
export async function enrollOwnerReceiver({ownerAccountId,address,exportViewing,importViewing,state,readiness,coverage,wait=ms=>new Promise(r=>setTimeout(r,ms)),attempts=120,now=Date.now}){
 if(typeof coverage!=='function')throw Error('Independent historical incoming-output coverage is required.');
 if(!uuid.test(ownerAccountId)||!isSaplingTestnet(address)||!Number.isSafeInteger(attempts)||attempts<2||attempts>120)throw Error('Exact native owner and managed receiver required.');
 const exported=await exportViewing();
 if(exported.network!=='testnet'||exported.address!==address||!isSaplingTestnet(exported.defaultAddress)||!Number.isSafeInteger(exported.birthday)||exported.birthday<4465126||typeof exported.viewingKey!=='string'||!/^zxviewtestsapling1[0-9a-z]{100,500}$/.test(exported.viewingKey))throw Error('Pinned Sapling viewing export did not match the owner wallet.');
 const fingerprint=digest(exported.viewingKey),name='owner-receiver.json',old=await state.read(name);
 if(old&&(old.ownerAccountId!==ownerAccountId||old.receiver!==address||old.birthday!==exported.birthday||old.viewingFingerprint!==fingerprint))throw Error('Enrollment identity changed; retain previous coverage and review privately.');
 const baseline=await readiness();if(exported.birthday>baseline.blocks)throw Error('Wallet birthday exceeds the current node tip.');
 let record={ownerAccountId,receiver:address,birthday:exported.birthday,viewingFingerprint:fingerprint,phase:'importing'};
 // Do not journal viewing keys, recovery phrases or RPC authentication.
 await state.write(name,record);
 const result=await importViewing(exported.viewingKey,exported.birthday);
 if(result.address!==exported.defaultAddress)throw Error('Imported viewing account does not match the exported key.');
 record={...record,phase:'scanning'};await state.write(name,record);
 let passes=0;
 for(let n=0;n<attempts;n++){
  await wait(15000);let chain;
  try{chain=await readiness();passes++;}catch{passes=0;continue;}
  if(passes<2)continue;
  try{if(await coverage()!==true){passes=0;continue;}}catch{passes=0;continue;}
  record={...record,coverageVerified:true,phase:'ready',network:'testnet',tipHeight:chain.blocks,observedAt:now()};await state.write(name,record);return record;
 }
 throw Error('Receiving wallet is still scanning; publishing remains closed. Resume the same enrollment.');
}
async function main(){
 process.umask(0o077);
 const config=await privateJson(process.argv[2]);
 if(process.argv.length!==3||config.ownerUsername!=='owner'||!uuid.test(config.ownerAccountId)||!isAbsolute(config.exportBinary??'')||!isAbsolute(config.serviceConfig??'')||!/^[a-f0-9]{64}$/.test(config.exportBinarySha256??''))throw Error('Reviewed private owner enrollment configuration required.');
 const binary=await lstat(config.exportBinary);if(!binary.isFile()||binary.isSymbolicLink()||binary.size>200*1024**2||(binary.mode&0o022)||digest(await readFile(config.exportBinary))!==config.exportBinarySha256)throw Error('Pinned read-only export companion required.');
 const service=await privateJson(config.serviceConfig),db=new DatabaseSync(service.database,{readOnly:true});let w;
 try{w=db.prepare('SELECT * FROM judge_private_wallets WHERE user=?').get(config.ownerAccountId);}finally{db.close();}
 if(!w||w.state!=='ready'||!w.backup_confirmed||!uuid.test(w.wallet_account)||!isAbsolute(service.walletRoot))throw Error('Owner must activate and back up the existing Test wallet.');
 const root=join(service.walletRoot,w.wallet_account),state=new PrivateState(await privateDirectory(config.journalRoot));
 const {walletRpc,chainRpc}=await configuredClients(config.rpcEnvironment);
 const journal=new DatabaseSync(service.database,{readOnly:true});let incoming;
 try{incoming=journal.prepare("SELECT txid,sapling_output,amount,memo,destination FROM judge_transfers WHERE user=? AND kind='grant' AND state='confirmed' AND destination=? ORDER BY rowid DESC LIMIT 1").get(config.ownerAccountId,w.address);}finally{journal.close();}
 if(!incoming)throw Error('No confirmed historical receipt available; publishing remains closed.');
 await enrollOwnerReceiver({ownerAccountId:config.ownerAccountId,address:w.address,state,coverage:()=>verifyIncomingCoverage(incoming,w.address,walletRpc,chainRpc),readiness:()=>checkReadiness(walletRpc,chainRpc),importViewing:importViewingKeyRpc(config.rpcEnvironment),exportViewing:async()=>{
  // Raw key stays in this private pipe. The validated signing binary is untouched.
  return new Promise((resolve,reject)=>{
   const child=execFile(config.exportBinary,[root],{timeout:60000,maxBuffer:8192,encoding:'utf8'},(error,stdout)=>{if(error)return reject(Error('Private viewing export unavailable.'));try{resolve(JSON.parse(stdout));}catch{reject(Error('Private viewing export unavailable.'));}});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({address:w.address}));
  });
 }});
 console.log('Owner receiver imported, strictly synchronized and historical incoming output verified. Private receipt retained; no funds moved.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Owner enrollment stopped; retain private state and existing receiver coverage. No payment or publication performed.');process.exitCode=1;});
