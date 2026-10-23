// Startup barrier only: an initialized node is not proof of current-tip synchronization.
import {connect} from 'node:net';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {configuredClient} from '../rpc.mjs';

class WrongNetwork extends Error {}
function deadline(promise,milliseconds){
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Node startup deadline reached.')),milliseconds);})]).finally(()=>clearTimeout(timer));
}
export function indexerListening(){
 return new Promise((resolve,reject)=>{
  const socket=connect({host:'127.0.0.1',port:18230});
  socket.setTimeout(2000,()=>socket.destroy(Error('Indexer startup pending.')));
  socket.once('connect',()=>{socket.destroy();resolve();});
  socket.once('error',reject);
 });
}
export async function waitForNode({chainRpc,probeIndexer=indexerListening,now=()=>performance.now(),pause=sleep,timeoutMs=180000}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw Error('Invalid startup deadline.');
 const end=now()+timeoutMs;
 while(now()<end){
  try{
   return await deadline((async()=>{
    const info=await chainRpc();
    if(info?.chain&&info.chain!=='test')throw new WrongNetwork('Wallet requires the configured TESTNET node.');
    if(info?.chain!=='test'||!Number.isSafeInteger(info.blocks)||info.blocks<=0)throw Error('Node initialization pending.');
    await probeIndexer();
    return info.blocks;
   })(),Math.max(1,end-now()));
  }catch(error){if(error instanceof WrongNetwork)throw error;}
  if(now()<end)await pause(Math.min(2000,end-now()));
 }
 throw Error('Node RPC/indexer startup deadline reached; wallet was not started.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 waitForNode({chainRpc:async()=>{const rpc=await configuredClient('ZEBRA');return rpc('getblockchaininfo',[]);}}).then(
  ()=>{console.log('TESTNET node RPC and loopback indexer initialized; synchronization is checked separately.');process.exit(0);},
  ()=>{console.error('Wallet startup blocked: check private TESTNET node RPC/indexer readiness.');process.exit(1);}
 );
}
