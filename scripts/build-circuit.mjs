// Reproduce the public-ceremony PLONK key; no circuit-specific secret is generated.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const dir='.sites-runtime/zk-build',ptau=dir+'/powers15.ptau';await mkdir(dir,{recursive:true});
const expected='982372c867d229c236091f767e703253249a9b432c1710b4f326306bfa2428a17b06240359606cfe4d580b10a5a1f63fbed499527069c18ae17060472969ae6e';
try{await readFile(ptau);}catch{
 const response=await fetch('https://raw.githubusercontent.com/enricobottazzi/ZK-SBT/main/powersOfTau28_hez_final_15.ptau');if(!response.ok)throw Error('Public ceremony download failed');await writeFile(ptau,new Uint8Array(await response.arrayBuffer()));
}
if(createHash('blake2b512').update(await readFile(ptau)).digest('hex')!==expected)throw Error('Public Powers of Tau hash mismatch.');
function run(...args){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)throw Error('Circuit build failed');}
run('node_modules/circom2/cli.js','circuits/auction.circom','--r1cs','--wasm','--sym','--O1','-l','node_modules/circomlib/circuits','-o',dir);
run('node_modules/snarkjs/cli.js','plonk','setup',dir+'/auction.r1cs',ptau,dir+'/auction.zkey');
run('node_modules/snarkjs/cli.js','zkey','export','verificationkey',dir+'/auction.zkey',dir+'/verification_key.json');
run('scripts/zk-assets.mjs');
