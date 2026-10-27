// Website side of the private SSH tunnel. No wallet key or transaction bytes here.
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateInvoice} from '../scanner/invoice.mjs';
export function canonicalManagedInvoice(db,user,id){
 const a=db.prepare('SELECT * FROM auctions WHERE id=?').get(id);
 if(!a||a.payment_mode!=='direct'||!a.result)throw Error('A verified direct-payment win is required.');
 const r=JSON.parse(a.result),winner=db.prepare('SELECT bidder_id FROM bids WHERE auction_id=? AND id=?').get(id,r.winnerId);
 if(a.owner_id===user||winner?.bidder_id!==user||r.status!=='zk-verified')throw Error('Only the verified winner can authorize this purchase.');
 const memo=`VEIL:${id}:${r.winnerId}`,invoiceId=createHash('sha256').update(JSON.stringify(['VEIL-INVOICE-v1','testnet',id,r.winnerId,a.payment_address,r.amount,memo,r.snapshotHash,r.declaredAt])).digest('hex');
 return validateInvoice({version:1,network:'testnet',invoiceId,auctionId:id,bidId:r.winnerId,address:a.payment_address,amount:r.amount,memo});
}
export function managedClient({tokenFile=process.env.VEIL_MANAGED_TOKEN_FILE,enabled=process.env.VEIL_MANAGED_ENABLED==='1',fetchImpl=fetch}={}){
 if(!enabled)return null;
 if(!tokenFile?.startsWith('/'))throw Error('A private managed service credential is required.');
 const st=lstatSync(tokenFile);if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)||st.size>256)throw Error('Private managed service credential permissions required.');
 const token=readFileSync(tokenFile,'utf8').trim();if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid managed service credential.');
 return async(action,user,input={})=>{
  const response=await fetchImpl('http://127.0.0.1:19070/v1',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action,user,input}),signal:AbortSignal.timeout(20000)});
  const text=await response.text();if(text.length>16384)throw Error('Managed service response exceeded limit.');
  const result=JSON.parse(text);if(!response.ok)throw Error('Wallet operation is unavailable. Refresh its retained status before retrying.');return result;
 };
}
