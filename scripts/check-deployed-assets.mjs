// Stream and hash each deployed proof asset. Does not deploy, change access or store bytes.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export async function checkDeployedAssets(base,manifest,fetcher=fetch,log=console.log) {
 const root=new URL(base);if(root.username||root.password||root.search||root.hash||root.pathname!=='/'||(root.protocol!=='https:'&&!(root.protocol==='http:'&&['127.0.0.1','[::1]'].includes(root.hostname))))throw Error('Use a clean HTTPS Site origin or loopback HTTP origin.');
 const parts=[...manifest.wasm,...manifest.zkey,...manifest.runtime];
 for(const part of parts){
  const response=await fetcher(new URL(part.url,root),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(180000)});
  if(response.status!==200||!response.body)throw Error(`Asset unavailable: ${part.url} (HTTP ${response.status}).`);
  const digest=createHash('sha256');let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.length;if(bytes>part.size)throw Error(`Asset size exceeded: ${part.url}.`);digest.update(chunk);}
  if(bytes!==part.size||digest.digest('hex')!==part.sha256)throw Error(`Asset integrity failed: ${part.url}.`);
  log(`PASS ${part.url} (${bytes} bytes)`);
 }
 log('All deployed proof assets match the tracked manifest. This does not validate deployment source, authentication or live payment.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const [base]=process.argv.slice(2);if(!base||process.argv.length!==3)throw Error('Usage: node scripts/check-deployed-assets.mjs https://EXISTING_SITE');
 const manifest=JSON.parse(await readFile(new URL('../shared/veil/zk/assets.json',import.meta.url),'utf8'));await checkDeployedAssets(base,manifest);
 }catch(e){console.error(e.message);process.exitCode=1;}
}
