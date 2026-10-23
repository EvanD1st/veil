'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,Upload,RefreshCw,ShieldCheck} from 'lucide-react';
import type {PaymentState} from '@/lib/veil/payment';
import {downloadJson} from '@/lib/veil/crypto';
export default function PaymentStatus({auctionId,now}:{auctionId:string;now:number}){
 const [state,setState]=useState<PaymentState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0);
 const [transaction,setTransaction]=useState(''),[output,setOutput]=useState('0');
 async function track(){
  const requestId=++sequence.current;setBusy(true);setError('');
  try{
   if(!/^[a-f0-9]{64}$/.test(transaction)||! /^(0|[1-9][0-9]{0,4})$/.test(output)||Number(output)>65535)throw Error('Enter the exact transaction ID and Sapling output index.');
   const response=await fetch(`/api/auctions/${auctionId}/payment/scan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txid:transaction,output:Number(output)}),signal:AbortSignal.timeout(20000)});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Could not queue verification.');if(requestId===sequence.current)setState(data);
  }catch(e){if(requestId===sequence.current)setError((e as Error).message);}finally{if(requestId===sequence.current)setBusy(false);}
 }
 async function load(file?:File,action?:string){
  const requestId=++sequence.current;
  setBusy(true);setError('');
  try{
   if(file&&file.size>6000)throw Error('Scanner report is too large.');
   const payload=file?JSON.parse(await file.text()):action?{action}:undefined;
   const response=await fetch(`/api/auctions/${auctionId}/payment${action?'/followup':''}`,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:undefined,body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});
   const data=await response.json() as PaymentState&{error?:string};
   if(!response.ok)throw Error(data.error||'Could not read payment status.');if(requestId===sequence.current)setState(data);
  }catch(e){if(requestId===sequence.current){setError((e as Error).message);setState(previous=>previous?{...previous,status:'needs-refresh'}:null);}}
  finally{if(requestId===sequence.current)setBusy(false);}
 }
 useEffect(()=>{void load();const interval=setInterval(()=>void load(),60000);return()=>clearInterval(interval);},[auctionId]);
 const status=state?.status==='scanner-confirmed'&&state.report&&state.report.expiresAt<=now?'needs-refresh':state?.status;
 const due=state?.workflow?.dueAt,overdue=typeof due==='number'&&now>=due;
 return <div className="privacy-note payment-check"><b><ShieldCheck size={17}/> Payment confirmation</b>
 <p>{status==='scanner-confirmed'?`Scanner-confirmed at ${new Date(state!.report!.observedAt).toLocaleTimeString()} · ${state!.report!.confirmations} confirmations. Evidence expires at ${new Date(state!.report!.expiresAt).toLocaleTimeString()}.`:status==='needs-refresh'?'The last scan is no longer current. Import a fresh report before relying on payment status.':status==='not-confirmed'?'The scanner did not confirm this payment on the active chain.':state?.configured?'No payment has been confirmed. A synchronized wallet scanner must check the shielded output.':'Check scanner availability and download the invoice for verification.'}</p>
 <div className="button-row"><button className="text-button" disabled={busy} onClick={()=>load()}><RefreshCw size={14}/>{busy?'Checking…':'Check status'}</button>
 {state&&<button className="text-button" onClick={()=>downloadJson(`veil-invoice-${auctionId}.json`,state.invoice)}><Download size={14}/> Download invoice</button>}
 {state?.configured&&<label className="text-button"><Upload size={14}/> Import scanner report<input className="sr-only" type="file" accept=".json" disabled={busy} onChange={e=>{load(e.target.files?.[0]);e.target.value='';}}/></label>}</div>
 {state&&!state.configured&&<p>Scanner not connected. Payment stays unverified until the site operator configures the trusted scanner public key.</p>}
 {state?.automation?.enabled&&<div className="key-card"><h3>Automatic payment verification</h3>
 {state.automation.txid?<><p>The selected transaction and Sapling output are registered. The scanner retries checks automatically; only a fresh, trusted signed report can confirm payment.</p><p>{state.automation.state==='unavailable'?'Scanner unavailable or waiting for synchronized services. Current evidence still expires normally.':state.automation.state==='stopped'?'Automatic checks ended after 30 days. Ask the operator before relying on older evidence.':'Verification is queued or being refreshed.'}</p></>:<>
 <p>After payment, register its exact transaction and output. This sends no funds. One output is bound to this invoice; ask the operator to review a mistaken selector.</p>
 <label>Transaction ID<input value={transaction} maxLength={64} autoComplete="off" spellCheck={false} onChange={e=>setTransaction(e.target.value.trim().toLowerCase())}/></label>
 <label>Sapling output index<input value={output} inputMode="numeric" maxLength={5} onChange={e=>setOutput(e.target.value)}/></label>
 <button className="button button-outline" disabled={busy} onClick={()=>void track()}>Register output for verification</button></>}
 </div>}
 {state?.workflow&&<div className="key-card"><h3>{overdue&&status!=='scanner-confirmed'?'Payment follow-up overdue':'Payment follow-up'}</h3>
 <p>{due?`Follow-up deadline: ${new Date(due).toLocaleString()}.`:'This auction has no payment follow-up deadline.'} {overdue&&status!=='scanner-confirmed'?'There is no current confirmation. This does not prove non-payment; contact the other participant before sending funds again.':''}</p>
 <p>Expired scanner evidence and an overdue follow-up are separate. The winner and published result remain final. No automatic reassignment, cancellation, refund or escrow occurs.</p>
 <div className="button-row">{!state.workflow.isOwner&&<button className="button button-outline" disabled={busy} onClick={()=>load(undefined,'reported-sent')}>Record that I sent payment</button>}
 {(overdue||!due)&&<button className="button button-outline" disabled={busy} onClick={()=>load(undefined,'requested-discussion')}>Request direct discussion</button>}</div>
 {state.workflow.actions.map((action,i)=><p key={i}>{action.byYou?'You':'The other participant'} {action.action==='reported-sent'?'reported sending payment (unverified)':'requested direct discussion'} at {new Date(action.recordedAt).toLocaleString()}.</p>)}
 </div>}
 {state&&<p className="field-hint">{status==='scanner-confirmed'?'Keep the invoice and refresh the scan before relying on confirmation again.':status==='needs-refresh'?'Rescan the same transaction and Sapling output, then import the new signed report. If the scanner is unavailable, wait for it to recover; an old report cannot confirm current payment.':status==='not-confirmed'?'Check the exact invoice address, amount and memo with the payer. Wait for at least three confirmations, then rescan the same output. Do not send another payment just because a scan failed.':'If already sent, wait for at least three confirmations, then ask the scanner operator to scan the transaction and output against this invoice. Import the signed report within five minutes.'}</p>}
 <p className="field-hint">Seller and winner must arrange delayed or unmatched payments directly. Split payments, overpayments and replacement outputs are unsupported.</p>
 <p className="field-hint">Reports trust the configured viewing wallet and scanner. They are not zero-knowledge payment proofs. A scan does not guarantee future finality, escrow, or delivery.</p>
 {error&&<p role="alert">{error}</p>}
 </div>;
}
