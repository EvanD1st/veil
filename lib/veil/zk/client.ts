import assets from './assets.json';
import {Auction,BidOpening,PublicBid,ProofBundle,PROOF_CIRCUIT} from '../core';
import {proofWitness,proofPublicSignals} from './protocol';
import {verifyHighestBid} from './verify';
import {proofDeadline} from './deadline';
export function runProofWorker(witness:unknown,progress:(s:string)=>void,signal?:AbortSignal,timeoutMs?:number):Promise<{proof:Record<string,unknown>;publicSignals:string[]}>{
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Proof cancelled. No result was published.','AbortError'));return;}
  const worker=new Worker('/zk/prover-worker.js');let settled=false;
  const finish=(error?:Error,result?:{proof:Record<string,unknown>;publicSignals:string[]})=>{if(settled)return;settled=true;deadline.stop();signal?.removeEventListener('abort',cancel);worker.terminate();if(error)reject(error);else resolve(result!);};
  const cancel=()=>finish(new DOMException('Proof cancelled. No result was published.','AbortError'));
  const deadline=proofDeadline(message=>finish(Error(message)),timeoutMs);
  signal?.addEventListener('abort',cancel,{once:true});
  worker.onerror=()=>finish(Error('The proof worker could not run. Reload and retry on a desktop browser.'));
  worker.onmessageerror=()=>finish(Error('The proof worker returned an unreadable response. Retry.'));
  worker.onmessage=({data})=>{if(settled)return;deadline.progress(data);if(data.error)finish(Error(data.error));else if(data.result)finish(undefined,data.result);else if(data.progress)progress(data.progress);};
  try{worker.postMessage({assets,witness});}catch(error){finish(error as Error);}
 });
}
export async function proveHighestBid(auction:Auction,bids:PublicBid[],openings:BidOpening[],winnerId:string|null,amount:string|null,progress:(s:string)=>void,signal?:AbortSignal):Promise<ProofBundle>{
 signal?.throwIfAborted();const witness=await proofWitness(auction,bids,openings,winnerId,amount);
 const result=await runProofWorker(witness,progress,signal);
 signal?.throwIfAborted();progress('Checking the highest-bid proof…');
 const proof=await verifyHighestBid({circuitId:PROOF_CIRCUIT,...result},proofPublicSignals(auction,bids,winnerId,amount));
 signal?.throwIfAborted();return proof;
}
