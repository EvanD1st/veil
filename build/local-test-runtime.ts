import beacon from '../tests/fixtures/quicknet-1000.json';
// Imported only by the DEV branch of the Worker in an explicitly isolated test server.
let clock=1692806364000-120001;
const nativeNow=Date.now;
export async function localTestRuntime(request:Request):Promise<Response|null>{
 Date.now=()=>clock;
 const url=new URL(request.url);
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
