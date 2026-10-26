import {createPublicKey,verify} from 'node:crypto';
// The unchanged VEIL-PAYMENT-REPORT-v1 serialization, tested against scanner/scan.mjs.
export function reviewableReport(signed,entitlement,auction,key,now=Date.now()){
 const r=signed?.report;
 if(!/^[a-f0-9]{64}$/.test(key??'')||!r||!/^[a-f0-9]{128}$/.test(signed.signature??'')||r.version!==1||r.network!=='testnet'||r.pool!=='sapling'||r.status!=='confirmed'||r.invoiceId!==entitlement.invoice_id||`testnet:${r.txid}:sapling:${r.output}`!==entitlement.output_key||r.address!==auction.payment_address)return false;
 const result=JSON.parse(auction.result);if(auction.result!==entitlement.result_binding||result.amount!==r.amount||r.memo!==`VEIL:${auction.id}:${result.winnerId}`||!Number.isSafeInteger(r.observedAt)||!Number.isSafeInteger(r.expiresAt)||r.observedAt>now+120000||r.expiresAt<=now||r.expiresAt-r.observedAt!==300000||!Number.isSafeInteger(r.confirmations)||r.confirmations<3||!Number.isSafeInteger(r.blockHeight)||!Number.isSafeInteger(r.tipHeight)||r.confirmations!==r.tipHeight-r.blockHeight+1||!/^[a-f0-9]{64}$/.test(r.blockHash))return false;
 const message=Buffer.from(JSON.stringify(['VEIL-PAYMENT-REPORT-v1',r.version,r.invoiceId,r.network,r.txid,r.output,r.pool,r.address,r.amount,r.memo,r.status,r.blockHash,r.blockHeight,r.tipHeight,r.confirmations,r.observedAt,r.expiresAt]));
 try{return verify(null,message,createPublicKey({key:Buffer.from('302a300506032b6570032100'+key,'hex'),format:'der',type:'spki'}),Buffer.from(signed.signature,'hex'));}catch{return false;}
}
