import verificationKey from './verification_key.json';
import verify from './vendor/plonk_verify.js';
import { validateProofBundle } from './protocol';
import type { ProofBundle } from '../core';
export async function verifyHighestBid(value: unknown, expected: string[]): Promise<ProofBundle> {
  const bundle=validateProofBundle(value,expected);
  try { if(await verify(verificationKey,bundle.publicSignals,bundle.proof))return bundle; } catch { /* fail closed */ }
  throw Error('The highest-bid proof is invalid. No result was accepted.');
}
