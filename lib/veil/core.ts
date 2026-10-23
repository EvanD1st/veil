import { poseidon4 } from 'poseidon-lite';
export const PROOF_CIRCUIT = 'veil-highest-bid-v2-8';
export const MAX_PROOF_BIDS = 8;
export const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const QUICKNET = {
  public_key: '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
  period: 3,
  genesis_time: 1692803367,
  hash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  groupHash: 'f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e',
  schemeID: 'bls-unchained-g1-rfc9380',
  metadata: { beaconID: 'quicknet' },
};
export const MAX_ZATOSHIS = 100000000000000n;
export type BidOpening = { version: 1 | 2; auctionId: string; bidId: string; amount: string; salt: string; context?: string };
export type ProofBundle = { circuitId: string; proof: Record<string, unknown>; publicSignals: string[] };
export type PublicBid = { id: string; commitment: string; ciphertextHash: string; acceptedAt: number; sequence: number };
export type BidEnvelope = PublicBid & { ciphertext: string };
export type Auction = {
  id: string; title: string; description: string; category: string; artwork: string;
  sellerName: string; reserve: string; closesAt: number; unlockRound: number;
  publicKey: JsonWebKey; createdAt: number; bidCount: number; isOwner: boolean;
  state: 'open' | 'closed' | 'result'; result: AuctionResult | null;
  paymentAddress: string | null;
  paymentWindowHours?: number | null;
  protocolVersion: 1 | 2; proofContext: string | null;
};
export type AuctionResult = { winnerId: string | null; amount: string | null; salt: string | null; snapshotHash: string; declaredAt: number; status: 'seller-declared' | 'zk-verified'; proof?: ProofBundle };

export function parseZec(value: string): bigint {
  if (!/^(0|[1-9]\d{0,6})(\.\d{1,8})?$/.test(value)) throw new Error('Use a ZEC amount with up to 8 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  if (result <= 0n || result > MAX_ZATOSHIS) throw new Error('Enter an amount above zero and at most 1,000,000 ZEC.');
  return result;
}
export function formatZec(value: string | bigint): string {
  const amount = BigInt(value);
  const fraction = (amount % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
  return `${amount / 100000000n}${fraction ? '.' + fraction : ''}`;
}
export function validZatoshis(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,14}$/.test(value) && BigInt(value) <= MAX_ZATOSHIS;
}
export function unlockRoundFor(deadline: number): number {
  // Round 1 is at genesis. Always choose the first round strictly after close.
  return Math.floor((deadline / 1000 - QUICKNET.genesis_time) / QUICKNET.period) + 2;
}
export function roundTimeMs(round: number): number {
  return (QUICKNET.genesis_time + (round - 1) * QUICKNET.period) * 1000;
}
export function toBase64(bytes: Uint8Array): string {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export function randomHex(size = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(size)), b => b.toString(16).padStart(2, '0')).join('');
}
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function commitmentFor(opening: BidOpening): Promise<string> {
  if (![1, 2].includes(opening.version) || !validZatoshis(opening.amount) || !/^[a-f0-9]{64}$/.test(opening.salt)) throw new Error('Invalid bid opening.');
  if (opening.version === 2) {
    if (!opening.context || !/^(0|[1-9][0-9]{0,76})$/.test(opening.context) || BigInt(opening.context) >= SNARK_FIELD || BigInt('0x' + opening.salt) >= SNARK_FIELD || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(opening.bidId)) throw new Error('Invalid proof-compatible opening.');
    return poseidon4([BigInt(opening.context), BigInt('0x' + opening.bidId.replace(/-/g, '')), BigInt(opening.amount), BigInt('0x' + opening.salt)]).toString(16).padStart(64, '0');
  }
  return sha256(JSON.stringify(['VEIL-BID-v1', opening.auctionId, opening.bidId, opening.amount, opening.salt]));
}
export async function auctionProofContext(a: { id: string; reserve: string; closesAt: number; unlockRound: number; publicKey: JsonWebKey; paymentAddress: string | null }): Promise<string> {
  const digest = await sha256(JSON.stringify(['VEIL-AUCTION-v2', PROOF_CIRCUIT, a.id, a.reserve, a.closesAt, a.unlockRound, a.publicKey.n, a.publicKey.e, a.paymentAddress, 'zcash-testnet']));
  return (BigInt('0x' + digest) % SNARK_FIELD).toString();
}
export async function snapshotHash(auctionId: string, bids: PublicBid[]): Promise<string> {
  const entries = [...bids].sort((a, b) => a.sequence - b.sequence).map(b => [b.sequence, b.id, b.commitment, b.ciphertextHash]);
  return sha256(JSON.stringify(['VEIL-LOG-v1', auctionId, entries]));
}
export function chooseWinner(openings: (BidOpening & { sequence: number })[], reserve: string): (BidOpening & { sequence: number }) | null {
  for (const bid of openings) if (!validZatoshis(bid.amount)) throw new Error('A bid could not be validated. Tally stopped.');
  const eligible = openings.filter(b => BigInt(b.amount) >= BigInt(reserve));
  eligible.sort((a, b) => BigInt(a.amount) > BigInt(b.amount) ? -1 : BigInt(a.amount) < BigInt(b.amount) ? 1 : a.sequence - b.sequence);
  return eligible[0] ?? null;
}
export function validateTimelockArmor(armor: string, round: number): void {
  if (typeof armor !== 'string' || armor.length < 250 || armor.length > 14000) throw new Error('Invalid sealed envelope size.');
  const match = armor.trim().match(/^-----BEGIN AGE ENCRYPTED FILE-----\n([A-Za-z0-9+/=\n]+)\n-----END AGE ENCRYPTED FILE-----$/);
  if (!match) throw new Error('A timelocked AGE envelope is required.');
  const encoded = match[1].replace(/\n/g, '');
  const decoded = atob(encoded);
  if (btoa(decoded) !== encoded) throw new Error('Non-canonical envelope encoding.');
  const marker = decoded.indexOf('\n--- ');
  if (!decoded.startsWith('age-encryption.org/v1\n') || marker < 0 || marker > 2048) throw new Error('Invalid envelope header.');
  const header = decoded.slice(0, marker);
  const recipients = header.split('\n').filter(line => line.startsWith('-> '));
  if (recipients.length !== 1 || recipients[0] !== `-> tlock ${round} ${QUICKNET.hash}`) throw new Error('The bid must use this auction’s exact unlock time and pinned beacon.');
}
export function paymentUri(address: string, amount: string, auctionId: string, bidId: string): string {
  if (!validZatoshis(amount)) throw new Error('Invalid payment amount.');
  if (!isSaplingTestnet(address)) throw new Error('A valid Sapling testnet address is required.');
  const memo = toBase64(new TextEncoder().encode(`VEIL:${auctionId}:${bidId}`)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `zcash:${address}?amount=${formatZec(amount)}&memo=${memo}`;
}
export function isSaplingTestnet(address: string): boolean {
  if (address !== address.toLowerCase() || !address.startsWith('ztestsapling1')) return false;
  const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const pos = address.lastIndexOf('1'), hrp = address.slice(0, pos), payload = address.slice(pos + 1);
  if (payload.length !== 75) return false; // 43-byte Sapling receiver + 6 checksum symbols
  const data = [...payload].map(c => alphabet.indexOf(c));
  if (data.some(x => x < 0)) return false;
  const values = [...hrp].map(c => c.charCodeAt(0) >> 5).concat([0], [...hrp].map(c => c.charCodeAt(0) & 31), data);
  let chk = 1;
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  for (const v of values) { const top = chk >>> 25; chk = ((chk & 0x1ffffff) << 5) ^ v; for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= generators[i]; }
  return (chk >>> 0) === 1 && (data[68] & 1) === 0;
}
