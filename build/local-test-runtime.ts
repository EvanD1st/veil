import beacon from '../tests/fixtures/quicknet-1000.json';
import receiver from '../tests/fixtures/synthetic-receiver.json';
import {env} from 'cloudflare:workers';
// Imported only by the DEV branch of the Worker in an explicitly isolated test server.
let clock=1692806364000-120001;
const nativeNow=Date.now;
export async function localTestRuntime(request:Request):Promise<Response|null>{
 Date.now=()=>clock;
 const url=new URL(request.url);
 // Explicit synthetic file metadata for portable Worker crypto regressions only.
 // Actual filesystem/content/download tests run against the native production artifact.
 const settings=env as unknown as Record<string,unknown>;
 settings.VEIL_DIGITAL_SELLERS=JSON.stringify({local_seller:receiver.address});
 settings.VEIL_DIGITAL_PUBLISHING_ENABLED='1';
 settings.VEIL_DIGITAL_VERIFY=async()=>true;
 const who=request.headers.get('oai-authenticated-user-id');
 if(url.pathname.startsWith('/api/digital/')){
  if(!who)return Response.json({error:'Local fixture identity required.'},{status:401});
  const db=env.DB as D1Database;
  if(url.pathname==='/api/digital/config')return Response.json({fixture:true,available:true,eligible:who==='local_seller',address:who==='local_seller'?receiver.address:null,explanation:'Synthetic loopback fixture only.',limits:{file:10485760,preview:2097152,account:50331648,total:268435456,reserve:1073741824}});
  if(url.pathname==='/api/digital/uploads'&&request.method==='POST'){
   if(who!=='local_seller')return Response.json({error:'Fixture seller required.'},{status:403});
   const bytes=await request.arrayBuffer();if(bytes.byteLength>4096)return Response.json({error:'Synthetic fixture limit.'},{status:413});
   const id=crypto.randomUUID().replaceAll('-',''),kind=url.searchParams.get('kind');
   if(!['preview','deliverable'].includes(kind??''))return Response.json({error:'Invalid fixture kind.'},{status:400});
   await db.prepare("INSERT INTO digital_assets VALUES(?,?,?,?,?,'complete',?,?,?,?)").bind(id,who,kind,'png','image/png',bytes.byteLength,bytes.byteLength,'fa'.repeat(32),clock).run();
   return Response.json({asset:{id,kind,format:'png',bytes:bytes.byteLength},fixture:true},{status:201});
  }
  if(url.pathname==='/api/digital/drafts'&&request.method==='POST'){
   const b=await request.json() as Record<string,string>,id=crypto.randomUUID();
   await db.prepare('INSERT INTO digital_drafts VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,who,b.previewId,b.fileId,b.category,b.license,b.edition,b.provenance,receiver.address,clock).run();return Response.json({draftId:id,fixture:true},{status:201});
  }
  if(url.pathname.startsWith('/api/digital/preview/'))return new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lKkAAAAASUVORK5CYII='),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});
  if(url.pathname==='/api/digital/purchases')return Response.json({purchases:[],fixture:true});
  return Response.json({error:'No real protected download exists in this synthetic Worker fixture.'},{status:404});
 }
 if(url.pathname==='/__veil/clock'){
  if(request.method==='POST'){
   const value=await request.json() as {now:number};
   if(!Number.isSafeInteger(value.now))return Response.json({error:'Invalid fixture clock.'},{status:400});
   clock=value.now;
  }
  return Response.json({now:clock,fixture:'quicknet-round-1000',wallTime:nativeNow()},{headers:{'Cache-Control':'no-store'}});
 }
 if(url.pathname==='/api/drand/public/1000')return Response.json(beacon,{headers:{'X-VEIL-Test-Fixture':'quicknet-round-1000','Cache-Control':'no-store'}});
 return null;
}
