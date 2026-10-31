// Read-only readiness/disk observation; no key generation, scan signing or wallet writes.
import {statfs,writeFile,rename} from 'node:fs/promises';
import {configuredClient} from '../rpc.mjs';
import {checkReadiness} from '../scan.mjs';
const root=process.env.VEIL_LAB_ROOT;
if(!root?.startsWith('/'))throw Error('VEIL_LAB_ROOT must name the dedicated Linux lab.');
let state={observedAt:Date.now(),ready:false,height:null,diskGiB:null,reason:'services-unavailable'};
try{
 const disk=await statfs(root),free=Number(disk.bavail)*Number(disk.bsize);state.diskGiB=Math.floor(free/1024**3);
 const chainRpc=await configuredClient('ZEBRA');
 const info=await chainRpc('getblockchaininfo',[]);
 if(info?.chain==='test'&&Number.isSafeInteger(info.blocks))state.height=info.blocks;
 if(free<5*1024**3)state.reason='low-disk';
 else{const walletRpc=await configuredClient('ZALLET');await checkReadiness(walletRpc,chainRpc);state.ready=true;state.reason='ready';}
}catch{/* Fixed labels only; never print credentials or raw RPC responses. */}
if(process.argv.includes('--write')){await writeFile(root+'/health.json.tmp',JSON.stringify(state),{mode:0o600});await rename(root+'/health.json.tmp',root+'/health.json');}
console.log(JSON.stringify(state));if(!state.ready)process.exitCode=1;
