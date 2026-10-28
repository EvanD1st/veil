// Operator-only client. Normal native sessions and the existing upload/create gates.
import {privateJson,PrivateState,privateDirectory} from './private-state.mjs';
import collection from './collection.json' with {type:'json'};
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export async function demoClient(config){
 const origin=new URL(config.origin);if(origin.protocol!=='https:'&&!(config.allowLoopback===true&&origin.hostname==='127.0.0.1'&&origin.protocol==='http:'))throw Error('Clean HTTPS origin required.');if(origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw Error('Invalid origin.');
 const login=await fetch(new URL('/login',origin),{method:'POST',redirect:'manual',headers:{Origin:origin.origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:config.username,password:config.password}),signal:AbortSignal.timeout(30000)});
 if(login.status!==303)throw Error('Demo seller login failed.');const cookie=login.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Session unavailable.');
 const request=async(path,body,extra={})=>{if(!path.startsWith('/api/'))throw Error('API path required.');const r=await fetch(new URL(path,origin),{redirect:'error',method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{Origin:origin.origin,'Content-Type':'application/json'}),...extra.headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000),...extra});const d=await r.json();if(!r.ok){const reason=typeof d?.error==='string'?d.error:'request rejected';throw Error('Demo API rejected request (HTTP '+r.status+'): '+reason);}return d;};
 const upload=async(bytes,kind)=>{const r=await fetch(new URL('/api/digital/uploads?kind='+kind+'&format=png',origin),{method:'POST',redirect:'error',headers:{Cookie:cookie,Origin:origin.origin,'Content-Type':'application/octet-stream','Content-Length':String(bytes.length)},body:bytes,signal:AbortSignal.timeout(60000)});if(r.status!==201)throw Error('Private artwork upload failed.');return (await r.json()).asset.id;};
 const logout=async()=>{await fetch(new URL('/logout',origin),{method:'POST',redirect:'manual',headers:{Cookie:cookie,Origin:origin.origin,'Content-Type':'application/x-www-form-urlencoded'},body:'',signal:AbortSignal.timeout(30000)});};
 return {origin:origin.origin,cookie,request,upload,logout};
}
export async function seedFamily(client,config,slug){
 const meta=collection.find(f=>f.slug===slug);if(!meta)throw Error('Unknown selected artwork.');const state=new PrivateState(await privateDirectory(config.journalRoot));
 let saved=await state.read('family-'+slug+'.json');
 if(!saved){
  const manifest=await privateJson(join(config.originalsRoot,'import.json')),binding=manifest.objects.find(x=>x.slug===slug);if(!binding||binding.file!==slug+'.png')throw Error('Exact private import required.');
  const bytes=await readFile(join(config.originalsRoot,binding.file));if(bytes.length!==meta.bytes||createHash('sha256').update(bytes).digest('hex')!==binding.sha256)throw Error('Selected original integrity mismatch.');
  // Uploads are not money movement. Persist each successfully acknowledged object.
  saved={slug,phase:'importing'};await state.write('family-'+slug+'.json',saved);
 }
 if(saved.phase==='importing'){
  const bytes=await readFile(join(config.originalsRoot,slug+'.png'));
  if(!saved.previewId){saved.previewId=await client.upload(bytes,'preview');await state.write('family-'+slug+'.json',saved);}
  if(!saved.fileId){saved.fileId=await client.upload(bytes,'deliverable');await state.write('family-'+slug+'.json',saved);}
  await client.request('/api/judging/worker/register',{slug,previewId:saved.previewId,fileId:saved.fileId});saved.phase='registered';await state.write('family-'+slug+'.json',saved);
 }
 const edition=await client.request('/api/judging/worker/reserve',{slug,windowSeconds:config.auctionWindowSeconds??3024000}),name=edition.auction_id+'.json';let job=await state.read(name);
 if(!job){const keys=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);job={editionId:edition.id,auctionId:edition.auction_id,version:1,privateKey:await crypto.subtle.exportKey('jwk',keys.privateKey),publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey),phase:'keys-secured'};await state.write(name,job);}
 // Keys are durably secured BEFORE opening bidding. Never generate replacement keys on retry.
 if(job.phase==='creating-unknown'){
  const existing=await client.request('/api/auctions/'+job.auctionId);if(existing.auction.publicKey.n!==job.publicKey.n)throw Error('Publication/key conflict.');await client.request('/api/judging/worker/bind',{id:edition.id});job.phase='open';await state.write(name,job);return job;
 }
 if(job.phase!=='keys-secured')return job;
 const cfg=await client.request('/api/digital/config');if(!cfg.eligible||!cfg.address)throw Error('Demo seller receiver is not covered.');
 const draft=await client.request('/api/digital/drafts',{previewId:saved.previewId,fileId:saved.fileId,category:meta.category,license:meta.license,edition:`Testnet edition ${edition.edition} / up to 5; artwork reused`,provenance:meta.provenance});
 job.phase='creating-unknown';await state.write(name,job);
 // Exactly one create attempt. If response is uncertain, the next run only reads this ID.
 await client.request('/api/auctions',{id:job.auctionId,title:meta.title+' · Testnet #'+edition.edition,description:'VEIL Genesis — downloadable testnet edition. The winning buyer can download this frozen artwork after the exact incoming testnet payment is verified. The seller can see losing bids after reveal.',sellerName:config.sellerName??config.username,category:meta.category,artwork:'orbit',digitalDraftId:draft.draftId,paymentAddress:cfg.address,reserve:config.reserveZatoshis??'10000',closesAt:edition.closes_at,publicKey:job.publicKey,paymentWindowHours:24});
 await client.request('/api/judging/worker/bind',{id:edition.id});job.phase='open';await state.write(name,job);return job;
}
export function familiesToSeed(currentFamilies){
 const alreadyListed=new Set((currentFamilies??[]).filter(f=>f.current?.auctionId).map(f=>f.slug));
 return collection.filter(f=>!alreadyListed.has(f.slug)).map(f=>f.slug);
}
export async function seedCollection(client,config){
 const listing=await client.request('/api/judging/catalogue');
 if(!Array.isArray(listing.families))throw Error('Artwork catalogue is unavailable.');
 const results=[];
 // Collection seeding always uses the requested 35-day deadline. Shorter
 // auctionWindowSeconds values are only for isolated single-family test fixtures.
 const productionConfig={...config,auctionWindowSeconds:3024000};
 for(const slug of familiesToSeed(listing.families))results.push(await seedFamily(client,productionConfig,slug));
 return {createdOrRecovered:results.length,alreadyListed:collection.length-results.length,auctions:results};
}
