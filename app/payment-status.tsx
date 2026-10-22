'use client';
import {useState} from 'react';
import {Download,Upload,RefreshCw,ShieldCheck} from 'lucide-react';
import type {PaymentState} from '@/lib/veil/payment';
import {downloadJson} from '@/lib/veil/crypto';
export default function PaymentStatus({auctionId,now}:{auctionId:string;now:number}){
 const [state,setState]=useState<PaymentState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(file?:File){setBusy(true);setError('');try{
  if(file&&file.size>6000)throw Error('Scanner report is too large.');
  const payload=file?JSON.parse(await file.text()):undefined;
  const response=await fetch(`/api/auctions/${auctionId}/payment`,{method:file?'POST':'GET',headers:file?{'Content-Type':'application/json'}:undefined,body:file?JSON.stringify(payload):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});
  const data=await response.json() as PaymentState & {error?:string};if(!response.ok)throw Error(data.error||'Could not read payment status.');setState(data);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const status=state?.status==='scanner-confirmed'&&state.report&&state.report.expiresAt<=now?'needs-refresh':state?.status;
 return <div className="privacy-note payment-check"><b><ShieldCheck size={17}/> Payment confirmation</b><p>{status==='scanner-confirmed'?`Scanner-confirmed at ${new Date(state!.report!.observedAt).toLocaleTimeString()} · ${state!.report!.confirmations} confirmations. Refresh after five minutes.`:status==='needs-refresh'?'The last scan is no longer current. Upload a fresh report before relying on payment status.':status==='not-confirmed'?'The scanner did not confirm this payment on the active chain.':state?.configured?'No payment has been confirmed. A synchronized wallet scanner must check the shielded output.':'Check scanner availability and download the invoice for verification.'}</p>
 <div className="button-row"><button className="text-button" disabled={busy} onClick={()=>load()}><RefreshCw size={14}/>{busy?'Checking…':'Check status'}</button>{state&&<button className="text-button" onClick={()=>downloadJson(`veil-invoice-${auctionId}.json`,state.invoice)}><Download size={14}/> Download invoice</button>}{state?.configured&&<label className="text-button"><Upload size={14}/> Import scanner report<input className="sr-only" type="file" accept=".json" disabled={busy} onChange={e=>{load(e.target.files?.[0]);e.target.value='';}}/></label>}</div>
 {state&&!state.configured&&<p>Scanner not connected. Payment stays unverified until the site operator configures the trusted scanner public key.</p>}
 {state&&<p className="field-hint">{status==='scanner-confirmed'?'Keep the invoice and refresh the scan before relying on confirmation again.':status==='needs-refresh'?'Rescan the same transaction and Sapling output, then import the new signed report. If the scanner is unavailable, wait for it to recover; an old report cannot confirm current payment.':status==='not-confirmed'?'Check the exact invoice address, amount and memo with the payer. Wait for at least three confirmations, then rescan the same output. Do not send another payment just because a scan failed.':'If already sent, wait for at least three confirmations, then ask the scanner operator to scan the transaction and output against this invoice. Import the signed report within five minutes.'}</p>}
 <p className="field-hint">If payment is delayed or cannot be matched, seller and winner must arrange the next step directly. There is no automatic payment deadline, cancellation, refund or second-place award. Split payments, overpayments and replacement outputs are unsupported.</p>
 <p className="field-hint">Reports trust the configured viewing wallet and scanner. They are not zero-knowledge payment proofs. A scan does not guarantee future finality, escrow, or delivery.</p>{error&&<p role="alert">{error}</p>}
 </div>;
}
