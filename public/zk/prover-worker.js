/* Private witness stays in this worker and is never sent to a server. */
self.onmessage=async({data})=>{
 const urls=[];
 try{
  const download=async(parts)=>{const chunks=[];for(const part of parts){const r=await fetch(part.url,{cache:'force-cache',signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Proof asset unavailable. Reload and try again.');const b=await r.arrayBuffer();const h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');if(b.byteLength!==part.size||h!==part.sha256)throw Error('Proof asset integrity check failed.');chunks.push(new Uint8Array(b));}const out=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let i=0;for(const c of chunks){out.set(c,i);i+=c.length;}return out;};
  self.postMessage({progress:'Loading verified proof assets…'});
  const runtime=await download(data.assets.runtime),url=URL.createObjectURL(new Blob([runtime],{type:'text/javascript'}));urls.push(url);importScripts(url);
  const wasm=await download(data.assets.wasm),zkey=await download(data.assets.zkey);
  self.postMessage({progress:'Proving every accepted bid locally…'});
  const result=await snarkjs.plonk.fullProve(data.witness,wasm,zkey,undefined,undefined,{singleThread:true});
  self.postMessage({result});
 }catch(error){self.postMessage({error:error?.message||'Proof generation failed.'});}
 finally{for(const url of urls)URL.revokeObjectURL(url);self.close();}
};
