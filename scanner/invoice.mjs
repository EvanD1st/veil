// Standalone invoice boundary; intentionally no wallet or network dependencies.
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function isSaplingTestnet(address) {
  if (typeof address !== 'string' || address !== address.toLowerCase() || !address.startsWith('ztestsapling1')) return false;
  const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l', pos = address.lastIndexOf('1');
  const hrp = address.slice(0, pos), payload = address.slice(pos + 1);
  if (payload.length !== 75) return false;
  const data = [...payload].map(c => alphabet.indexOf(c));
  if (data.some(x => x < 0)) return false;
  const values = [...hrp].map(c => c.charCodeAt(0) >> 5).concat([0], [...hrp].map(c => c.charCodeAt(0) & 31), data);
  let chk = 1;
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  for (const v of values) { const top = chk >>> 25; chk = ((chk & 0x1ffffff) << 5) ^ v; for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= generators[i]; }
  return (chk >>> 0) === 1 && (data[68] & 1) === 0;
}
export function validateInvoice(invoice) {
  const fields = ['version','network','invoiceId','auctionId','bidId','address','amount','memo'];
  if (!invoice || typeof invoice !== 'object' || Array.isArray(invoice) || Object.keys(invoice).sort().join() !== fields.sort().join() ||
      invoice.version !== 1 || invoice.network !== 'testnet' || typeof invoice.invoiceId !== 'string' || typeof invoice.auctionId !== 'string' || typeof invoice.bidId !== 'string' || !/^[a-f0-9]{64}$/.test(invoice.invoiceId) ||
      !UUID.test(invoice.auctionId) || !UUID.test(invoice.bidId) || !isSaplingTestnet(invoice.address) ||
      typeof invoice.amount !== 'string' || !/^[1-9][0-9]{0,14}$/.test(invoice.amount) || BigInt(invoice.amount) > 100000000000000n ||
      invoice.memo !== `VEIL:${invoice.auctionId}:${invoice.bidId}`) throw Error('Invalid testnet invoice.');
  return invoice;
}
export function decimalZec(amount) {
  const n = BigInt(amount);
  return `${n / 100000000n}.${(n % 100000000n).toString().padStart(8,'0')}`;
}
export function paymentRequest(invoice) {
  validateInvoice(invoice);
  return `zcash:${invoice.address}?amount=${decimalZec(invoice.amount)}&memo=${Buffer.from(invoice.memo,'utf8').toString('base64url')}`;
}
// JSON numeric literal assembled from integer arithmetic, never floating-point arithmetic.
export function sendingRecipients(invoice) {
  validateInvoice(invoice);
  return `[{"address":${JSON.stringify(invoice.address)},"amount":${decimalZec(invoice.amount)},"memo":${JSON.stringify(Buffer.from(invoice.memo,'utf8').toString('hex'))}}]`;
}
