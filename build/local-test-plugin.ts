import type {Plugin} from 'vite';
const hosts=new Set(['localhost','127.0.0.1','::1']);
const addresses=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const identities=new Set(['seller',...Array.from({length:10},(_,i)=>`bidder-${i+1}`),'observer']);
/** Deliberate impersonation for isolated loopback tests; never installed in builds. */
export function localTestIdentity():Plugin{
 const downloads:Record<string,number>={};
 return {name:'veil-local-test-identity',apply:'serve',configureServer(server){
  server.middlewares.use((req,res,next)=>{
   for(const name of Object.keys(req.headers))if(name.startsWith('oai-authenticated-'))delete req.headers[name];
   for(let i=req.rawHeaders.length-2;i>=0;i-=2)if(req.rawHeaders[i].toLowerCase().startsWith('oai-authenticated-'))req.rawHeaders.splice(i,2);
   const url=new URL(req.url||'/','http://127.0.0.1');
   const hostname=(req.headers.host||'').replace(/^\[/,'').replace(/\](:\d+)?$/, '').split(':')[0];
   if(!hosts.has(hostname)||!addresses.has(req.socket.remoteAddress||'')){res.statusCode=403;res.end('Local tests require loopback.');return;}
   if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)){res.statusCode=403;res.end();return;}
   if(url.pathname==='/__veil/assets'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(downloads));return;}
   if(url.pathname.startsWith('/zk/'))downloads[url.pathname]=(downloads[url.pathname]||0)+1;
   if(url.pathname==='/__veil/identity'){
    const identity=url.searchParams.get('as');if(!identity||!identities.has(identity)){res.statusCode=400;res.end('Choose seller, bidder-1..10 or observer.');return;}
    res.setHeader('Set-Cookie',`__veil_test_identity=${identity}; Path=/; HttpOnly; SameSite=Strict`);
    res.setHeader('Cache-Control','no-store');res.statusCode=302;res.setHeader('Location','/');res.end();return;
   }
   const identity=req.headers.cookie?.match(/(?:^|;\s*)__veil_test_identity=([^;]+)/)?.[1];
   if(identity&&identities.has(identity))for(const [name,value] of Object.entries({'oai-authenticated-user-id':`local_${identity}`,'oai-authenticated-user-email':`${identity}@veil.test`})){
    req.headers[name]=value;req.rawHeaders.push(name,value);
   }
   next();
  });
 }};
}
