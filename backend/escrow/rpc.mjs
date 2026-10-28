// Linux executor transport only. Separate from scanner RPC allowlist and never website-imported.
import {lstatSync,openSync,closeSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const READ_WALLET=['rpc.discover','getwalletstatus','z_viewtransaction','z_getaccount','z_getbalanceforaccount','z_listunspent','pczt_inspect','decoderawtransaction'];
const PREPARE=['pczt_create','pczt_prove','pczt_sign','pczt_extract'];
const READ_CHAIN=['getblockchaininfo','getblockheader','getblock','getblockhash','getrawtransaction'];
function privateFile(path){if(!isAbsolute(path))throw Error('Executor requires an absolute private file path.');const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077))throw Error('Executor requires owner-only native Linux files.');return path;}
export function openPcztJournal(path){if(process.platform==='win32')throw Error('Live executor storage requires Linux permissions.');if(!isAbsolute(path))throw Error('Use an absolute private journal path.');try{privateFile(path);}catch(e){if(e.code!=='ENOENT')throw e;closeSync(openSync(path,'wx',0o600));}privateFile(path);const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000');return db;}
export function executorRpc({url,cookieFile,kind,allowPreparation=false,allowBroadcast=false,fetcher=fetch}){
 const u=new URL(url);if(!['127.0.0.1','[::1]'].includes(u.hostname)||u.protocol!=='http:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!['wallet','chain'].includes(kind))throw Error('Executor RPC requires a numeric loopback URL.');
 const allowed=new Set(kind==='wallet'?[...READ_WALLET,...(allowPreparation?PREPARE:[])]:[...READ_CHAIN,...(allowBroadcast?['sendrawtransaction']:[])]);
 const raw=async(method,paramsJson)=>{
  if(!allowed.has(method))throw Error('Executor RPC method disabled.');
  if(typeof paramsJson!=='string'||paramsJson.length>16000000||!Array.isArray(JSON.parse(paramsJson)))throw Error('Invalid bounded RPC parameters.');
  const auth=readFileSync(privateFile(cookieFile),'utf8').trim();if(!/^[^:\r\n]+:[^\r\n]+$/.test(auth))throw Error('Invalid executor cookie format.');
  try{
   const r=await fetcher(u,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(auth).toString('base64')},body:'{"jsonrpc":"2.0","id":"veil-escrow","method":'+JSON.stringify(method)+',"params":'+paramsJson+'}',signal:AbortSignal.timeout(PREPARE.includes(method)?180000:30000)});
   if(!r.ok||!r.body)throw Error();let count=0,chunks=[];for await(const chunk of r.body){count+=chunk.length;if(count>20000000)throw Error();chunks.push(chunk);}const d=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(d.id!=='veil-escrow'||d.error||!Object.hasOwn(d,'result'))throw Error();return d.result;
  }catch{throw Error('Executor RPC unavailable or ambiguous; no automatic retry. Inspect private recovery state.');}
 };
 const call=(method,params)=>raw(method,JSON.stringify(params));call.raw=raw;return call;
}