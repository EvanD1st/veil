import { Auction, BidOpening, PublicBid, ProofBundle, MAX_PROOF_BIDS, PROOF_CIRCUIT, SNARK_FIELD, commitmentFor, validZatoshis } from '../core';
export function proofPublicSignals(auction: Auction, bids: PublicBid[], winnerId: string | null, amount: string | null): string[] {
  if (auction.protocolVersion !== 2 || !auction.proofContext || bids.length > MAX_PROOF_BIDS) throw Error('This auction does not support this proof circuit.');
  const sorted = [...bids].sort((a,b)=>a.sequence-b.sequence);
  if (new Set(sorted.map(b=>b.id)).size !== sorted.length || new Set(sorted.map(b=>b.sequence)).size !== sorted.length) throw Error('Duplicate accepted record.');
  const index = winnerId ? sorted.findIndex(b=>b.id===winnerId)+1 : 0;
  if (winnerId && (!index || !validZatoshis(amount))) throw Error('The winner is not in the accepted log.');
  if (!winnerId && amount !== null) throw Error('A no-winner result must have no price.');
  const ids = sorted.map(b=>BigInt('0x'+b.id.replace(/-/g,'')).toString());
  const commitments = sorted.map(b=>{if(!/^[0-9a-f]{64}$/.test(b.commitment) || BigInt('0x'+b.commitment)>=SNARK_FIELD)throw Error('Invalid field commitment.');return BigInt('0x'+b.commitment).toString();});
  while(ids.length<MAX_PROOF_BIDS){ids.push('0');commitments.push('0');}
  return [auction.proofContext,auction.reserve,String(sorted.length),String(index),amount??'0',...ids,...commitments];
}
export async function proofWitness(auction: Auction, bids: PublicBid[], openings: BidOpening[], winnerId: string | null, amount: string | null) {
  const publicSignals = proofPublicSignals(auction,bids,winnerId,amount), sorted=[...bids].sort((a,b)=>a.sequence-b.sequence);
  if(openings.length!==sorted.length || new Set(openings.map(o=>o.bidId)).size!==openings.length)throw Error('Every accepted bid must be opened exactly once.');
  const amounts:string[]=[],salts:string[]=[];
  for(const bid of sorted){const o=openings.find(o=>o.bidId===bid.id);if(!o||o.version!==2||o.auctionId!==auction.id||o.context!==auction.proofContext||await commitmentFor(o)!==bid.commitment)throw Error('A private opening does not match its accepted commitment.');amounts.push(o.amount);salts.push(BigInt('0x'+o.salt).toString());}
  while(amounts.length<MAX_PROOF_BIDS){amounts.push('0');salts.push('0');}
  return {context:publicSignals[0],reserve:publicSignals[1],count:publicSignals[2],winnerIndex:publicSignals[3],winningAmount:publicSignals[4],bidIds:publicSignals.slice(5,5+MAX_PROOF_BIDS),commitments:publicSignals.slice(5+MAX_PROOF_BIDS),amounts,salts};
}
export function validateProofBundle(value: unknown, expected: string[]): ProofBundle {
  if(!value||typeof value!=='object')throw Error('A highest-bid proof is required.');
  const bundle=value as ProofBundle;
  if(bundle.circuitId!==PROOF_CIRCUIT||!Array.isArray(bundle.publicSignals)||bundle.publicSignals.length!==expected.length||bundle.publicSignals.some((v,i)=>typeof v!=='string'||v!==expected[i]))throw Error('Proof inputs do not match this auction and its complete accepted log.');
  const proof=bundle.proof;
  const points=['A','B','C','Z','T1','T2','T3','Wxi','Wxiw'],evals=['eval_a','eval_b','eval_c','eval_s1','eval_s2','eval_zw'];
  if(!proof||typeof proof!=='object'||Array.isArray(proof)||proof.protocol!=='plonk'||proof.curve!=='bn128'||Object.keys(proof).sort().join(',')!==[...points,...evals,'protocol','curve'].sort().join(','))throw Error('Invalid proof encoding.');
  const integer=(v:unknown)=>typeof v==='string'&&/^(0|[1-9][0-9]{0,77})$/.test(v);
  for(const p of points)if(!Array.isArray(proof[p])||(proof[p] as unknown[]).length!==3||!(proof[p] as unknown[]).every(integer))throw Error('Invalid proof point.');
  for(const e of evals)if(!integer(proof[e])||BigInt(proof[e] as string)>=SNARK_FIELD)throw Error('Invalid proof evaluation.');
  return {circuitId:bundle.circuitId,proof,publicSignals:[...bundle.publicSignals]};
}
