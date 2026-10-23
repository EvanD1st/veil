import { Auction, sha256 } from './core';
export const PAYMENT_CONFIRMATIONS=3;
export type PaymentInvoice={version:1;network:'testnet';invoiceId:string;auctionId:string;bidId:string;address:string;amount:string;memo:string};
export type PaymentReport={version:1;invoiceId:string;network:'testnet';txid:string;output:number;pool:'sapling';address:string;amount:string;memo:string;status:'confirmed'|'not-confirmed';blockHash:string|null;blockHeight:number|null;tipHeight:number;confirmations:number;observedAt:number;expiresAt:number};
export type SignedPaymentReport={report:PaymentReport;signature:string};
export type PaymentWorkflow={dueAt:number|null;overdue:boolean;isOwner:boolean;actions:{action:string;recordedAt:number;byYou:boolean}[]};
export type PaymentState={automation?:{enabled:boolean;state:string;txid:string|null;output:number|null;nextCheckAt:number|null};workflow?:PaymentWorkflow;configured:boolean;invoice:PaymentInvoice;status:'unverified'|'scanner-confirmed'|'needs-refresh'|'not-confirmed';report:PaymentReport|null};
export async function paymentInvoice(auction:Auction):Promise<PaymentInvoice>{
 const r=auction.result;if(!r?.winnerId||!r.amount||!auction.paymentAddress)throw Error('This auction has no payment request.');
 const memo=`VEIL:${auction.id}:${r.winnerId}`;
 const invoiceId=await sha256(JSON.stringify(['VEIL-INVOICE-v1','testnet',auction.id,r.winnerId,auction.paymentAddress,r.amount,memo,r.snapshotHash,r.declaredAt]));
 return {version:1,network:'testnet',invoiceId,auctionId:auction.id,bidId:r.winnerId,address:auction.paymentAddress,amount:r.amount,memo};
}
export function reportMessage(r:PaymentReport):Uint8Array{
 return new TextEncoder().encode(JSON.stringify(['VEIL-PAYMENT-REPORT-v1',r.version,r.invoiceId,r.network,r.txid,r.output,r.pool,r.address,r.amount,r.memo,r.status,r.blockHash,r.blockHeight,r.tipHeight,r.confirmations,r.observedAt,r.expiresAt]));
}
export async function validatePaymentReport(value:unknown,invoice:PaymentInvoice,publicKeyHex:string,now=Date.now()):Promise<SignedPaymentReport>{
 const fail=()=>{throw Error('Invalid or mismatched scanner report.');};
 if(!/^[a-f0-9]{64}$/.test(publicKeyHex))throw Error('A trusted payment scanner is not configured.');
 if(!value||typeof value!=='object')return fail();
 const signed=value as SignedPaymentReport,r=signed.report;
 const fields=['version','invoiceId','network','txid','output','pool','address','amount','memo','status','blockHash','blockHeight','tipHeight','confirmations','observedAt','expiresAt'];
 if(!r||Object.keys(r).sort().join(',')!==fields.sort().join(',')||typeof signed.signature!=='string'||!/^[a-f0-9]{128}$/.test(signed.signature))return fail();
 if(r.version!==1||r.network!=='testnet'||r.invoiceId!==invoice.invoiceId||r.pool!=='sapling'||r.address!==invoice.address||r.amount!==invoice.amount||r.memo!==invoice.memo||!/^[a-f0-9]{64}$/.test(r.txid))return fail();
 for(const n of [r.output,r.tipHeight,r.confirmations,r.observedAt,r.expiresAt])if(!Number.isSafeInteger(n)||n<0)return fail();
 if(r.output>100000||r.observedAt>now+30000||r.observedAt<now-300000||r.expiresAt<=now||r.expiresAt<=r.observedAt||r.expiresAt-r.observedAt>300000)throw Error('Scanner report has expired or its clock is invalid. Scan again.');
 if(r.status==='confirmed'){
  if(typeof r.blockHash!=='string'||!/^[a-f0-9]{64}$/.test(r.blockHash)||!Number.isSafeInteger(r.blockHeight)||r.blockHeight!<0||r.confirmations<PAYMENT_CONFIRMATIONS||r.confirmations!==r.tipHeight-r.blockHeight!+1)return fail();
 }else if(r.status==='not-confirmed'){
  if(r.blockHash!==null||r.blockHeight!==null||r.confirmations!==0)return fail();
 }else return fail();
 const bytes=(hex:string)=>Uint8Array.from(hex.match(/../g)!,x=>parseInt(x,16));
 const key=await crypto.subtle.importKey('raw',bytes(publicKeyHex),{name:'Ed25519'},false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',key,bytes(signed.signature),reportMessage(r) as Uint8Array<ArrayBuffer>))throw Error('This report was not signed by the configured scanner.');
 return {report:r,signature:signed.signature};
}
