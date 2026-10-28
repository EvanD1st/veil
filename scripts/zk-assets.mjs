import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out='frontend/public/zk/veil-highest-bid-v2-8'; await mkdir(out,{recursive:true});
const digest=b=>createHash('sha256').update(b).digest('hex');
const assets={};
for(const [name,source] of Object.entries({wasm:'.sites-runtime/zk-build/auction_js/auction.wasm',zkey:'.sites-runtime/zk-build/auction.zkey',runtime:'node_modules/snarkjs/build/snarkjs.min.js'})){
 const bytes=await readFile(source),parts=[];
 for(let i=0;i<bytes.length;i+=20*1024*1024){const part=bytes.subarray(i,i+20*1024*1024),file=`${name}-${parts.length}.${name==='runtime'?'js':'bin'}`;await writeFile(`${out}/${file}`,part);parts.push({url:`/zk/veil-highest-bid-v2-8/${file}`,sha256:digest(part),size:part.length});}
 assets[name]=parts;
}
await copyFile('.sites-runtime/zk-build/verification_key.json','shared/veil/zk/verification_key.json');
await copyFile('.sites-runtime/zk-build/verification_key.json',`${out}/verification_key.json`);
await writeFile('shared/veil/zk/assets.json',JSON.stringify(assets,null,2)+'\n');
await copyFile('shared/veil/zk/vendor/LICENSE',`${out}/SNARKJS-LICENSE.txt`);
console.log('Proof assets packaged',Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,v.reduce((n,p)=>n+p.size,0)])));
