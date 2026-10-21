import assets from './assets.json';
import { Auction, BidOpening, PublicBid, ProofBundle, PROOF_CIRCUIT } from '../core';
import { proofWitness, proofPublicSignals } from './protocol';
import { verifyHighestBid } from './verify';
export async function proveHighestBid(auction:Auction,bids:PublicBid[],openings:BidOpening[],winnerId:string|null,amount:string|null,progress:(s:string)=>void):Promise<ProofBundle>{
 const witness=await proofWitness(auction,bids,openings,winnerId,amount);
 const result=await new Promise<{proof:Record<string,unknown>;publicSignals:string[]}>((resolve,reject)=>{
  const worker=new Worker('/zk/prover-worker.js');
  const timer=setTimeout(()=>{worker.terminate();reject(Error('Proof generation timed out. Try on a desktop browser.'));},300000);
  const done=()=>{clearTimeout(timer);worker.terminate();};
  worker.onerror=()=>{done();reject(Error('The proof worker could not run. Reload and retry on a desktop browser.'));};
  worker.onmessage=({data})=>{if(data.progress)progress(data.progress);else if(data.error){done();reject(Error(data.error));}else if(data.result){done();resolve(data.result);}};
  worker.postMessage({assets,witness});
 });
 progress('Checking the highest-bid proof…');
 return verifyHighestBid({circuitId:PROOF_CIRCUIT,...result},proofPublicSignals(auction,bids,winnerId,amount));
}
