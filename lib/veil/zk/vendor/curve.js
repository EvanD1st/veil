// VEIL curve adapter for the unmodified snarkjs PLONK verification algebra.
// No dynamic WebAssembly compilation: suitable for the Worker verifier.
import { bn254, bn254_Fr as F } from '@noble/curves/bn254.js';
export const R = F.ORDER;
const P = bn254.fields.Fp.ORDER;
function canonical(n, modulus) { if (typeof n !== 'bigint' || n < 0n || n >= modulus) throw Error('Non-canonical field element'); return n; }
export function unstringifyBigInts(value) {
  if (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)) { if (value.length > 78) throw Error('Oversized integer'); return BigInt(value); }
  if (Array.isArray(value)) return value.map(unstringifyBigInts);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,unstringifyBigInts(v)]));
  return value;
}
export const Scalar = { geq:(a,b)=>a>=BigInt(b), lt:(a,b)=>a<BigInt(b), fromRprLE:n=>n, fromRprBE:bytes=>BigInt('0x'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')) };
function write32(target, offset, n) { const hex=n.toString(16).padStart(64,'0'); for(let i=0;i<32;i++)target[offset+i]=parseInt(hex.slice(i*2,i*2+2),16); }
const Fr = {
  fromObject:n=>canonical(n,R), e:n=>F.create(BigInt(n)), mul:(a,b)=>F.mul(a,b), square:a=>F.sqr(a), sub:(a,b)=>F.sub(a,b),
  one:1n, zero:0n, div:(a,b)=>F.div(a,b), add:(a,b)=>F.add(a,b), neg:a=>F.neg(a), toString:(a,radix=10)=>a.toString(radix), n8:32,
  toRprBE:write32, w:Array.from({length:29},(_,i)=>F.pow(5n,(R-1n)/(1n<<BigInt(i)))),
};
const C1=bn254.G1.Point, C2=bn254.G2.Point;
const G1 = {
  fromObject:raw=>{
    if(!Array.isArray(raw)||raw.length!==3)throw Error('Invalid G1 encoding');
    const [x,y,z]=raw; canonical(x,P);canonical(y,P);
    if(z===0n && x===0n && y===1n)return C1.ZERO;
    if(z!==1n)throw Error('Expected affine G1 encoding');
    const p=C1.fromAffine({x,y});p.assertValidity();return p;
  },
  isValid:p=>{try{if(!p.is0())p.assertValidity();return true;}catch{return false;}},
  toAffine:p=>p, toString:p=>JSON.stringify(p.toAffine(),(_,v)=>typeof v==='bigint'?v.toString():v),
  timesFr:(p,s)=>s===0n||p.is0()?C1.ZERO:p.multiplyUnsafe(s), add:(a,b)=>a.add(b), sub:(a,b)=>a.subtract(b), neg:p=>p.negate(), one:C1.BASE, F:{n8:32},
  toRprUncompressed:(out,offset,p)=>{const {x,y}=p.toAffine();write32(out,offset,x);write32(out,offset+32,y);},
};
const G2 = {
  fromObject:raw=>{
    if(!Array.isArray(raw)||raw.length!==3||raw.some(a=>!Array.isArray(a)||a.length!==2))throw Error('Invalid G2 encoding');
    raw.flat().forEach(n=>canonical(n,P));
    if(raw[2][0]!==1n||raw[2][1]!==0n)throw Error('Expected affine G2 encoding');
    const p=C2.fromAffine({x:{c0:raw[0][0],c1:raw[0][1]},y:{c0:raw[1][0],c1:raw[1][1]}});p.assertValidity();return p;
  },one:C2.BASE,
};
const curve={r:R,Fr,G1,G2,pairingEq:async(...args)=>{
  const pairs=[];for(let i=0;i<args.length;i+=2)if(!args[i].is0()&&!args[i+1].is0())pairs.push({g1:args[i],g2:args[i+1]});
  return bn254.fields.Fp12.eql(bn254.pairingBatch(pairs),bn254.fields.Fp12.ONE);
}};
export async function getCurveFromName(name){if(name!=='bn128')throw Error('Unsupported proof curve');return curve;}
