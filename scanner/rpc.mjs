import { readFile, stat } from 'node:fs/promises';
import { createPrivateKey } from 'node:crypto';
export class SafeError extends Error {}
const fail=message=>{throw new SafeError(message);};
const ALLOWED=new Set(['getwalletstatus','z_viewtransaction','rpc.discover','getblockchaininfo','getblock','getblockhash','getblockheader']);
export function rpc(url,authorization,label='Local',fetcher=fetch){
 let u;try{u=new URL(url);}catch{fail(`${label} RPC URL is missing or invalid.`);}
 if(!['127.0.0.1','[::1]'].includes(u.hostname)||u.protocol!=='http:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')fail(`${label} RPC requires a numeric loopback HTTP URL without credentials, query or path.`);
 return async(method,params)=>{
  if(!ALLOWED.has(method))fail('Only scanner read methods are allowed.');
  const auth=typeof authorization==='function'?await authorization():authorization;
  try{
   const r=await fetcher(u,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Basic '+Buffer.from(auth).toString('base64')}:{})},body:JSON.stringify({jsonrpc:'2.0',id:'veil',method,params}),signal:AbortSignal.timeout(30000)});
   if(!r.ok)fail(`${label} RPC HTTP failure (${r.status}); check service and authentication.`);
   const data=await r.json();
   if(!data||data.id!=='veil'||(data.jsonrpc!=null&&data.jsonrpc!=='2.0')||(!Object.hasOwn(data,'result')&&!data.error))fail(`${label} RPC returned an unsupported response envelope.`);
   if(data.error)fail(`${label} RPC ${method} failed; check local service logs privately.`);
   return data.result;
  }catch(e){if(e instanceof SafeError)throw e;fail(`${label} RPC unavailable, timed out or returned invalid JSON.`);}
 };
}
async function privateFile(path,label){
 try{const s=await stat(path);if(!s.isFile()||(process.platform!=='win32'&&(s.mode&0o077)!==0))fail(`${label} must be an owner-only regular file.`);return await readFile(path,'utf8');}
 catch(e){if(e instanceof SafeError)throw e;fail(`${label} file is missing or unreadable.`);}
}
export async function readSigningKey(env=process.env){
 if(!env.VEIL_SCANNER_KEY_FILE)fail('Missing VEIL_SCANNER_KEY_FILE.');
 const bytes=await privateFile(env.VEIL_SCANNER_KEY_FILE,'Scanner signing key');
 let key;try{key=createPrivateKey(bytes);}catch{fail('Scanner signing key is invalid or unsupported.');}
 if(key.asymmetricKeyType!=='ed25519')fail('Scanner key must be Ed25519.');return key;
}
export async function configuredClients(env=process.env){
 const clients=[];
 for(const name of ['ZALLET','ZEBRA']){
  if(!env[`${name}_RPC_URL`])fail(`Missing ${name}_RPC_URL.`);
  const cookie=env[`${name}_COOKIE_FILE`],auth=env[`${name}_RPC_AUTH`];
  if(Boolean(cookie)===Boolean(auth))fail(`Configure exactly one ${name}_COOKIE_FILE or ${name}_RPC_AUTH.`);
  const authorization=async()=>{const value=cookie?(await privateFile(cookie,`${name} RPC cookie`)).trim():auth;if(!/^[^:\r\n]+:[^\r\n]+$/.test(value))fail(`${name} RPC authentication has an unsupported format.`);return value;};
  await authorization(); // Diagnose missing credentials even before contacting either service.
  clients.push(rpc(env[`${name}_RPC_URL`],authorization,name));
 }
 return {walletRpc:clients[0],chainRpc:clients[1]};
}
