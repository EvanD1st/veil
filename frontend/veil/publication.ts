import type {Auction,AuctionResult,PublicBid} from '../../shared/veil/core';
import {snapshotHash,commitmentFor} from '../../shared/veil/core';
import {proofPublicSignals} from '../../shared/veil/zk/protocol';
import {verifyHighestBid} from '../../shared/veil/zk/verify';
export type PublicationDetail={auction:Auction;bids:PublicBid[];snapshotHash:string};
export type PublicationAttempt={auction:Auction;bids:PublicBid[];payload:{winnerId:string|null;amount:string|null;salt:string|null;openedCount:number;proof?:AuctionResult['proof'];snapshotHash:string}};
export type PublicationOutcome={status:'matched'|'conflict'|'unknown';message:string;detail?:PublicationDetail};
const keyFingerprint=(key:JsonWebKey)=>JSON.stringify([key.kty,key.n,key.e,key.alg,key.ext,key.key_ops]);
export async function reconcilePublication(attempt:PublicationAttempt,read:()=>Promise<PublicationDetail>):Promise<PublicationOutcome>{
 let detail:PublicationDetail;
 try{detail=await read();}catch{return {status:'unknown',message:'Publication status is unknown. Check status before taking further action; do not publish again.'};}
 const {auction,bids,payload}=attempt,r=detail.auction.result;
 const conflict=():PublicationOutcome=>({status:'conflict',message:'A different auction log or result is stored. Stop and review the exported record.',detail});
 if((detail.auction.paymentMode??'direct')!==(auction.paymentMode??'direct')||JSON.stringify(detail.auction.fulfillmentTerms??null)!==JSON.stringify(auction.fulfillmentTerms??null))return conflict();
 if(detail.auction.id!==auction.id||detail.auction.protocolVersion!==auction.protocolVersion||detail.auction.proofContext!==auction.proofContext||detail.auction.reserve!==auction.reserve||detail.auction.closesAt!==auction.closesAt||detail.auction.unlockRound!==auction.unlockRound||detail.auction.paymentAddress!==auction.paymentAddress||keyFingerprint(detail.auction.publicKey)!==keyFingerprint(auction.publicKey)||(detail.auction.paymentWindowHours??null)!==(auction.paymentWindowHours??null))return conflict();
 if(detail.snapshotHash!==payload.snapshotHash||await snapshotHash(auction.id,detail.bids)!==payload.snapshotHash||await snapshotHash(auction.id,bids)!==payload.snapshotHash||detail.bids.length!==payload.openedCount)return conflict();
 if(!r)return {status:'unknown',message:'No result is visible yet. The original request may still be completing. Check status; no second publication has been sent.',detail};
 if(r.winnerId!==payload.winnerId||r.amount!==payload.amount||r.salt!==payload.salt||r.snapshotHash!==payload.snapshotHash)return conflict();
 try{
  if(auction.protocolVersion===2){if(r.status!=='zk-verified')return conflict();await verifyHighestBid(r.proof,proofPublicSignals(auction,detail.bids,r.winnerId,r.amount));}
  else {if(r.status!=='seller-declared'||r.proof)return conflict();if(r.winnerId){const bid=detail.bids.find(b=>b.id===r.winnerId);if(!bid||await commitmentFor({version:1,auctionId:auction.id,bidId:r.winnerId,amount:r.amount!,salt:r.salt!})!==bid.commitment)return conflict();}}
 }catch{return conflict();}
 return {status:'matched',message:'Result published and reconciled with the stored auction and complete log.',detail};
}
/** A write is attempted once. A lost response is resolved only through a read. */
export async function publishOnce(attempt:PublicationAttempt,write:()=>Promise<unknown>,read:()=>Promise<PublicationDetail>):Promise<PublicationOutcome>{
 try{await write();}catch{/* A transport error does not establish whether the server committed. */}
 return reconcilePublication(attempt,read);
}
