/* Private witness stays in this worker and is never sent to a server. */
self.onmessage=async({data})=>{
 const urls=[];
 try{
  let cache;try{if(self.caches)cache=await self.caches.open('veil-verified-proof-assets-v1');}catch{/* Storage is optional; integrity checks are not. */}
  const total=Object.values(data.assets).flat().reduce((n,p)=>n+p.size,0);let verified=0,activity=0;const inflight=new Map();
  const notify=(message,detail={})=>self.postMessage({progress:message,...detail});
  class IntegrityError extends Error{}
  const download=async(parts)=>{
   const chunks=[];
   for(const part of parts){
    let bytes,cached;const cacheKey=part.url+'?sha256='+part.sha256;
    try{cached=await cache?.match(cacheKey);}catch{/* Continue without persistent caching. */}
    const label=cached?'Loading cached proof assets':'Downloading proof assets';
    for(let attempt=1;attempt<=3;attempt++){
     try{
      notify(`${label}: ${(verified/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB`,{phase:'download',loaded:verified,total,attempt});
      // Bound each attempt, while allowing a slow healthy 20 MiB stream to finish.
      const response=attempt===1&&cached?cached:await fetch(part.url,{cache:'no-store',signal:AbortSignal.timeout(300000)});
      if(!response.ok){const error=Error(`Proof asset unavailable (${response.status}). Retry shortly.`);error.retryable=response.status===408||response.status===429||response.status>=500;throw error;}
      const reader=response.body?.getReader();const pieces=[];let loaded=0,lastProgress=0;
      if(reader){while(true){const next=await reader.read();if(next.done)break;loaded+=next.value.byteLength;activity+=next.value.byteLength;
       if(loaded>part.size){await reader.cancel();throw new IntegrityError('Proof asset integrity check failed.');}
       pieces.push(next.value);
       if(loaded-lastProgress>=65536||loaded===part.size){lastProgress=loaded;inflight.set(part.url,loaded);const current=verified+[...inflight.values()].reduce((n,v)=>n+v,0);notify(`${label}: ${(current/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB`,{phase:'download',loaded:current,total,activity,attempt});}
      }
      bytes=new Uint8Array(loaded);let offset=0;for(const piece of pieces){bytes.set(piece,offset);offset+=piece.length;}
      }else bytes=new Uint8Array(await response.arrayBuffer());
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
      if(bytes.byteLength!==part.size||hash!==part.sha256)throw new IntegrityError('Proof asset integrity check failed.');
      if(cache&&!cached){try{await cache.put(cacheKey,new Response(bytes));}catch{/* A full cache must not block proof generation. */}}
      break;
     }catch(error){
      inflight.delete(part.url);
      if(error instanceof IntegrityError){try{await cache?.delete(cacheKey);}catch{}throw error;}
      if(error.retryable===false||attempt===3)throw error;
      notify(`Proof download interrupted. Retrying (${attempt}/2)…`,{phase:'retry',attempt,loaded:verified,total});
      await new Promise(resolve=>setTimeout(resolve,attempt*500));
     }
    }
    chunks.push(bytes);inflight.delete(part.url);verified+=part.size;
   }
   const out=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
  };
  notify('Loading verified proof assets…',{phase:'download',loaded:0,total});
  const runtime=await download(data.assets.runtime),url=URL.createObjectURL(new Blob([runtime],{type:'text/javascript'}));urls.push(url);importScripts(url);
  // At most two streams; retain manifest order when assembling the proving key.
  const wasm=await download(data.assets.wasm),zkeyParts=[];
  for(let i=0;i<data.assets.zkey.length;i+=2)zkeyParts.push(...await Promise.all(data.assets.zkey.slice(i,i+2).map(part=>download([part]))));
  const zkey=new Uint8Array(zkeyParts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of zkeyParts){zkey.set(part,offset);offset+=part.length;}
  notify('Computing the private witness…',{phase:'prove'});
  // Relay only fixed stage labels, never witness values or raw prover logs.
  const logger={debug:message=>{const match=String(message).match(/^> ROUND ([1-5])$/);if(match)notify(`Proving every accepted bid: stage ${match[1]} of 5…`,{phase:'prove',stage:Number(match[1]),stages:5});},info:()=>{},warn:()=>{},error:()=>{}};
  const result=await snarkjs.plonk.fullProve(data.witness,wasm,zkey,logger,undefined,{singleThread:true});
  self.postMessage({result});
 }catch(error){self.postMessage({error:error?.message||'Proof generation failed.'});}
 finally{for(const url of urls)URL.revokeObjectURL(url);self.close();}
};
