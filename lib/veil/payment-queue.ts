import {env} from 'cloudflare:workers';
import {ApiError,paymentStatus,submitPaymentReport} from './server';
import {sha256} from './core';
import {validatePaymentReport} from './payment';

type Job={id:string;auction_id:string;requested_by:string;invoice_id:string;txid:string;output:number;state:string;created_at:number;next_attempt_at:number;checked_at:number|null;failures:number;lease_id:string|null;lease_until:number;last_lease_id:string|null;last_report_hash:string|null;expires_at:number};
const database=()=>env.DB as D1Database;
const setting=(name:string)=>(env as unknown as Record<string,unknown>)[name];
export function automaticScanningEnabled(){return /^[a-f0-9]{64}$/.test(String(setting('VEIL_SCANNER_SERVICE_TOKEN_SHA256')??''))&&/^[a-f0-9]{64}$/.test(String(setting('VEIL_SCANNER_PUBLIC_KEY')??''));}
export async function automationStatus(auctionId:string){
 const enabled=automaticScanningEnabled();
 if(!enabled)return {enabled:false,state:'unavailable' as const,txid:null,output:null,nextCheckAt:null};
 const job=await database().prepare('SELECT * FROM payment_scan_jobs WHERE auction_id=?').bind(auctionId).first<Job>();
 const health=await database().prepare('SELECT last_seen FROM scanner_service_health WHERE id=1').first<{last_seen:number}>();
 const now=Date.now();
 return {enabled:true,state:!health||health.last_seen<now-120000?'unavailable':job?(job.expires_at<=now?'stopped':job.state):'idle',txid:job?.txid??null,output:job?.output??null,nextCheckAt:job?.next_attempt_at??null};
}
export async function queuePaymentScan(auctionId:string,input:Record<string,unknown>,userId:string){
 const current=await paymentStatus(auctionId,userId); // Existing seller/winner permission and canonical invoice.
 if(!automaticScanningEnabled())throw new ApiError('Automatic verification is unavailable.',503);
 if(Object.keys(input).sort().join(',')!=='output,txid'||typeof input.txid!=='string'||!/^[a-f0-9]{64}$/.test(input.txid)||!Number.isInteger(input.output)||(input.output as number)<0||(input.output as number)>65535)throw new ApiError('Enter the exact transaction ID and Sapling output index.');
 if(current.report&&(current.report.txid!==input.txid||current.report.output!==input.output))throw new ApiError('This invoice is already bound to another output.',409);
 const previous=await database().prepare('SELECT * FROM payment_scan_jobs WHERE auction_id=?').bind(auctionId).first<Job>();
 if(previous){
  if(previous.txid!==input.txid||previous.output!==input.output)throw new ApiError('An exact output is already queued for this invoice. Ask the operator to review a mistaken selector.',409);
  return paymentStatus(auctionId,userId); // Idempotent; never bypass retry/backoff by clicking again.
 }
 const now=Date.now(),id=crypto.randomUUID();
 const inserted=await database().prepare(`INSERT INTO payment_scan_jobs(id,auction_id,requested_by,invoice_id,txid,output,created_at,next_attempt_at,expires_at)
 SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM payment_scan_jobs WHERE expires_at>?)<1000 AND (SELECT COUNT(*) FROM payment_scan_jobs WHERE requested_by=? AND created_at>?)<5
 ON CONFLICT(auction_id) DO NOTHING`).bind(id,auctionId,userId,current.invoice.invoiceId,input.txid,input.output,now,now,now+30*86400000,now,userId,now-3600000).run();
 if(!inserted.meta.changes)throw new ApiError('Verification queue limit reached. Retry later.',429);
 return paymentStatus(auctionId,userId);
}
export async function scannerAuthentication(request:Request){
 const token=request.headers.get('authorization')??'';
 if(!automaticScanningEnabled()||!/^Bearer [a-f0-9]{64}$/.test(token)||await sha256(token.slice(7))!==setting('VEIL_SCANNER_SERVICE_TOKEN_SHA256'))throw new ApiError('Scanner authentication required.',401);
}
function exactFields(input:Record<string,unknown>,fields:string[]){if(Object.keys(input).sort().join(',')!==fields.sort().join(','))throw new ApiError('Invalid scanner request.');}
async function heartbeat(){await database().prepare('INSERT INTO scanner_service_health VALUES(1,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen').bind(Date.now()).run();}
export async function scannerExchange(input:Record<string,unknown>){
 const now=Date.now();
 if(input.action==='claim'){
  exactFields(input,['action']);
  await heartbeat();
  const lease=crypto.randomUUID();
  // One worker lease at a time, including concurrent requests. A crash recovers after ten minutes.
  const job=await database().prepare(`UPDATE payment_scan_jobs SET state='scanning',lease_id=?,lease_until=? WHERE id=(SELECT id FROM payment_scan_jobs WHERE expires_at>? AND next_attempt_at<=? AND lease_until<=? ORDER BY next_attempt_at,id LIMIT 1)
 AND NOT EXISTS(SELECT 1 FROM payment_scan_jobs WHERE lease_until>?) RETURNING *`).bind(lease,now+600000,now,now,now,now).first<Job>();
  if(!job)return {job:null,retryAfter:15};
  const state=await paymentStatus(job.auction_id,job.requested_by);
  if(state.invoice.invoiceId!==job.invoice_id)throw new ApiError('Queued invoice changed.',409);
  return {job:{id:job.id,leaseId:lease,invoice:state.invoice,txid:job.txid,output:job.output,leaseUntil:now+600000}};
 }
 if(input.action!=='report'&&input.action!=='unavailable')throw new ApiError('Unknown scanner operation.');
 exactFields(input,input.action==='report'?['action','jobId','leaseId','signed']:['action','jobId','leaseId']);
 if(typeof input.jobId!=='string'||typeof input.leaseId!=='string')throw new ApiError('Invalid scanner lease.');
 const job=await database().prepare('SELECT * FROM payment_scan_jobs WHERE id=?').bind(input.jobId).first<Job>();
 if(!job)throw new ApiError('Unknown scanner job.',404);
 const reportHash=input.action==='report'?await sha256(JSON.stringify(input.signed)):null;
 if(reportHash&&job.last_lease_id===input.leaseId&&job.last_report_hash===reportHash)return {accepted:true}; // Lost-ACK retry; no report rewrite or freshness extension.
 if(job.lease_id!==input.leaseId||job.lease_until<=now||job.expires_at<=now)throw new ApiError('Scanner lease expired.',409);
 if(input.action==='report'){
  const state=await paymentStatus(job.auction_id,job.requested_by);
  const signed=await validatePaymentReport(input.signed,state.invoice,String(setting('VEIL_SCANNER_PUBLIC_KEY')));
  if(signed.report.txid!==job.txid||signed.report.output!==job.output||signed.report.invoiceId!==job.invoice_id)throw new ApiError('Report does not match the queued output.');
  const existing=await database().prepare('SELECT signed_report FROM payment_reports WHERE auction_id=?').bind(job.auction_id).first<{signed_report:string}>();
  // If the report commit succeeded but the job update did not, retry the same signed bytes safely.
  if(existing?.signed_report!==JSON.stringify(signed))await submitPaymentReport(job.auction_id,signed as unknown as Record<string,unknown>,job.requested_by);
  await database().prepare("UPDATE payment_scan_jobs SET state='pending',checked_at=?,failures=0,next_attempt_at=?,last_lease_id=?,last_report_hash=?,lease_id=NULL,lease_until=0 WHERE id=? AND lease_id=?").bind(now,now+60000,input.leaseId,reportHash,job.id,input.leaseId).run();
 }else{
  const delay=Math.min(300000,15000*2**Math.min(job.failures,5));
  await database().prepare("UPDATE payment_scan_jobs SET state='unavailable',checked_at=?,failures=failures+1,next_attempt_at=?,lease_id=NULL,lease_until=0 WHERE id=? AND lease_id=?").bind(now,now+delay,job.id,input.leaseId).run();
 }
 await heartbeat();return {accepted:true};
}
