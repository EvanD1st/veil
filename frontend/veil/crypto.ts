import { QUICKNET, BidOpening, BidEnvelope, commitmentFor, fromBase64, toBase64, randomHex, sha256, validateTimelockArmor } from '../../shared/veil/core';
// Load the encryption dependency with the app. An action must not depend on a
// later dynamic-chunk request, which can fail independently of the loaded page.
import { Buffer, HttpChainClient, timelockDecrypt, timelockEncrypt } from 'tlock-js';

function bytes(value: Uint8Array): ArrayBuffer { return value.slice().buffer as ArrayBuffer; }
export async function generateAuctionKeys(): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  return { publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey), privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey) };
}
export async function encryptForSeller(opening: BidOpening, publicKey: JsonWebKey): Promise<string> {
  const rsa = await crypto.subtle.importKey('jwk', publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const context = new TextEncoder().encode(`VEIL-ENVELOPE-v1:${opening.auctionId}:${opening.bidId}`);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context }, aes, new TextEncoder().encode(JSON.stringify(opening)));
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsa, await crypto.subtle.exportKey('raw', aes));
  return JSON.stringify({ version: 1, key: toBase64(new Uint8Array(wrapped)), iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) });
}
export async function decryptForSeller(encrypted: string, privateKey: JsonWebKey, auctionId: string, bidId: string): Promise<BidOpening> {
  const envelope = JSON.parse(encrypted);
  if (envelope.version !== 1 || typeof envelope.key !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.data !== 'string') throw new Error('Invalid seller envelope.');
  const rsa = await crypto.subtle.importKey('jwk', privateKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  const key = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsa, bytes(fromBase64(envelope.key)));
  const aes = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
  const context = new TextEncoder().encode(`VEIL-ENVELOPE-v1:${auctionId}:${bidId}`);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(fromBase64(envelope.iv)), additionalData: context }, aes, bytes(fromBase64(envelope.data)));
  const opening = JSON.parse(new TextDecoder().decode(plain)) as BidOpening;
  if (opening.auctionId !== auctionId || opening.bidId !== bidId) throw new Error('Bid is bound to another auction or participant.');
  await commitmentFor(opening);
  return opening;
}
function beaconClient() {
  return new HttpChainClient({ baseUrl: `${location.origin}/api/drand`, info: async () => QUICKNET }, {
    disableBeaconVerification: false, noCache: false,
    chainVerificationParams: { chainHash: QUICKNET.hash, publicKey: QUICKNET.public_key },
  });
}
export async function sealBid(auctionId: string, publicKey: JsonWebKey, unlockRound: number, amount: string, proofContext?: string | null) {
  const opening: BidOpening = { version: proofContext ? 2 : 1, auctionId, bidId: crypto.randomUUID(), amount, salt: proofContext ? '00' + randomHex(31) : randomHex(), ...(proofContext ? { context: proofContext } : {}) };
  const inner = await encryptForSeller(opening, publicKey);
  const ciphertext = await timelockEncrypt(unlockRound, Buffer.from(inner), beaconClient());
  validateTimelockArmor(ciphertext, unlockRound);
  return { opening, id: opening.bidId, commitment: await commitmentFor(opening), ciphertext, ciphertextHash: await sha256(ciphertext) };
}
export async function openBid(envelope: BidEnvelope, privateKey: JsonWebKey, auctionId: string, unlockRound: number) {
  validateTimelockArmor(envelope.ciphertext, unlockRound);
  if (await sha256(envelope.ciphertext) !== envelope.ciphertextHash) throw new Error('The stored envelope changed. Tally stopped.');
  const inner = await timelockDecrypt(envelope.ciphertext, beaconClient());
  const opening = await decryptForSeller(inner.toString('utf8'), privateKey, auctionId, envelope.id);
  if (await commitmentFor(opening) !== envelope.commitment) throw new Error('A bid does not match its acceptance receipt. Tally stopped.');
  return { ...opening, sequence: envelope.sequence };
}
export function saveKey(auctionId: string, key: JsonWebKey) { localStorage.setItem(`veil:auction-key:${auctionId}`, JSON.stringify(key)); }
export function readKey(auctionId: string): JsonWebKey | null { const value = localStorage.getItem(`veil:auction-key:${auctionId}`); return value ? JSON.parse(value) : null; }
export {downloadJson} from './download';
