import * as fs from 'node:fs/promises';
import {sessionUser,verifyPassword} from './accounts.mjs';
import {managedClient,canonicalManagedInvoice,acceptManagedSelector} from '../judging/managed-client.mjs';
import {catalogue,requestWallet,walletStatus,registerFamily,reserveEdition,bindEdition,claimProof,finishProof,windowSeconds,requestEdition,JudgingError} from './judging-store.mjs';
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...(status===429?{'Retry-After':'60'}:{})});res.end(JSON.stringify(value));};
export function judgingHandler(db,origin,{managed=managedClient()}={}){
 const expected=new URL(origin),rates=new Map();let reauthRunning=0;
 const limit=user=>{const now=Date.now();for(const [k,v] of rates)if(v.until<=now)rates.delete(k);let r=rates.get(user);if(!r){if(rates.size>=200)throw new JudgingError('Please retry later.',429);r={n:0,until:now+600000};rates.set(user,r);}if(++r.n>(user===process.env.VEIL_DEMO_SELLER_ID?120:20))throw new JudgingError('Please retry later.',429);};
 return async(req,res,next)=>{
  const url=new URL(req.url,expected);if(!url.pathname.startsWith('/api/judging/'))return next();
  try{
   if(url.pathname==='/api/judging/managed/selector'){
    if(req.method!=='POST'||!managed?.authenticated?.(req.headers.authorization))throw new JudgingError('Service authentication required.',401);
    if(!/^[a-f0-9]{64}$/.test(process.env.VEIL_SCANNER_PUBLIC_KEY??'')||!/^[a-f0-9]{64}$/.test(process.env.VEIL_SCANNER_SERVICE_TOKEN_SHA256??''))throw new JudgingError('Automatic verification is unavailable.',503);
    let n=0,parts=[];for await(const c of req){n+=c.length;if(n>2048)throw new JudgingError('Request too large.',413);parts.push(c);}
    return json(res,200,acceptManagedSelector(db,JSON.parse(Buffer.concat(parts).toString('utf8'))));
   }
   const user=sessionUser(db,req.headers.cookie??'');if(!user)throw new JudgingError('Authentication required.',401);
   if(req.method==='GET'){
    if(url.pathname==='/api/judging/catalogue')return json(res,200,{name:'VEIL Genesis — Testnet Editions',families:catalogue(db),demoActive:process.env.VEIL_DEMO_ENABLED==='1',disclosure:'Platform demo seller: the operator retains its auction keys and can read losing bids after reveal. Repeat test editions reuse artwork; a bid does not guarantee a win.'});
    if(url.pathname==='/api/judging/wallet')return json(res,200,managed?await managed('state',user.userId):walletStatus(db,user.userId));
    if(url.pathname==='/api/judging/wallet/transfers'&&managed)return json(res,200,await managed('transfers',user.userId));
   }
   if(req.method!=='POST')throw new JudgingError('Endpoint not found.',404);
   if(req.headers.origin!==expected.origin||req.headers['sec-fetch-site']==='cross-site')throw new JudgingError('Cross-site requests are not accepted.',403);
   limit(user.userId);if(!req.headers['content-type']?.startsWith('application/json'))throw new JudgingError('JSON required.',415);
   let size=0,parts=[];for await(const c of req){size+=c.length;if(size>8192)throw new JudgingError('Request too large.',413);parts.push(c);}let b;try{b=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!b||Array.isArray(b)||typeof b!=='object')throw Error();}catch{throw new JudgingError('Invalid JSON.',400);}
   const fields=keys=>{if(Object.keys(b).some(k=>!keys.includes(k)))throw new JudgingError('Unexpected fields.',400);};
   if(url.pathname==='/api/judging/wallet/activate'){fields([]);return json(res,202,managed?await managed('activate',user.userId):requestWallet(db,user.userId));}
   if(url.pathname==='/api/judging/wallet/backup'){
    fields(['password']);if(reauthRunning>=2)throw new JudgingError('Please retry later.',429);let valid;reauthRunning++;try{valid=await verifyPassword(db,user.userId,b.password);}finally{reauthRunning--;}
    if(!valid)throw new JudgingError('Reauthentication failed.',403);
    if(managed)return json(res,200,await managed('backup',user.userId));
    throw new JudgingError('Individual wallet backup is unavailable. No shared master recovery material will be exported.',503);
   }
   if(managed&&url.pathname==='/api/judging/wallet/confirm-backup'){fields(['answers']);return json(res,200,await managed('confirm-backup',user.userId,{answers:b.answers}));}
   if(managed&&url.pathname==='/api/judging/wallet/refresh'){fields([]);return json(res,202,await managed('refresh',user.userId));}
   if(managed&&url.pathname==='/api/judging/wallet/fund'){fields([]);return json(res,202,await managed('fund',user.userId));}
   if(managed&&['/api/judging/wallet/quote','/api/judging/wallet/pay'].includes(url.pathname)){
    const pay=url.pathname.endsWith('/pay');fields(pay?['auctionId','quoteId','affirmative']:['auctionId']);
    let invoice;try{invoice=canonicalManagedInvoice(db,user.userId,b.auctionId);}catch{throw new JudgingError('Only the verified winning buyer can review and authorize this payment.',403);}
    return json(res,pay?202:200,await managed(pay?'pay':'quote',user.userId,pay?{invoice,quoteId:b.quoteId,affirmative:b.affirmative}:{invoice}));
   }
   if(url.pathname==='/api/judging/wallet/pay'||url.pathname==='/api/judging/wallet/fund')throw new JudgingError('Live spending and starter grants remain disabled pending isolated recovery, fee and outgoing-payment validation.',503);
   if(url.pathname==='/api/judging/request-edition'){fields(['slug']);if(process.env.VEIL_DEMO_ENABLED!=='1')throw new JudgingError('New demo editions are paused.',503);return json(res,202,requestEdition(db,user.userId,b.slug));}
   if(!url.pathname.startsWith('/api/judging/worker/')||!process.env.VEIL_DEMO_SELLER_ID||user.userId!==process.env.VEIL_DEMO_SELLER_ID)throw new JudgingError('Demo seller authorization required.',403);
   if(process.env.VEIL_DEMO_ENABLED!=='1')throw new JudgingError('Automatic demo editions are paused.',503);
   const action=url.pathname.slice('/api/judging/worker/'.length);
   if(action==='demand'){fields([]);const row=db.prepare("SELECT r.family FROM judging_edition_requests r WHERE NOT EXISTS(SELECT 1 FROM judging_editions e WHERE e.family=r.family AND e.state<>'verified') GROUP BY r.family ORDER BY MIN(r.requested_at) LIMIT 1").get();return json(res,200,{family:row?.family??null});}
   if(action==='register'){
    fields(['slug','previewId','fileId']);const p=process.env.VEIL_GENESIS_IMPORT_FILE;if(!p?.startsWith('/'))throw new JudgingError('Private reviewed import manifest required.',503);const st=await fs.lstat(p);if(!st.isFile()||st.isSymbolicLink()||st.size>16384||(st.mode&0o022))throw new JudgingError('Private reviewed import manifest required.',503);
    return json(res,200,registerFamily(db,b,user.userId,JSON.parse(await fs.readFile(p,'utf8'))));
   }
   if(action==='reserve'){fields(['slug','windowSeconds']);const seconds=b.windowSeconds===undefined?windowSeconds(process.env.VEIL_DEMO_WINDOW_SECONDS??'3024000'):windowSeconds(typeof b.windowSeconds==='number'&&Number.isSafeInteger(b.windowSeconds)?String(b.windowSeconds):b.windowSeconds);return json(res,200,reserveEdition(db,b.slug,{seconds}));}
   if(action==='bind'){fields(['id']);return json(res,200,bindEdition(db,b.id,user.userId));}
   if(action==='claim'){fields([]);return json(res,200,{job:claimProof(db)});}
   if(action==='phase'){fields(['id','token','phase']);if(typeof b.token!=='string'||!/^[a-f0-9]{64}$/.test(b.token))throw new JudgingError('Invalid lease.',400);return json(res,200,finishProof(db,b.id,b.token,b.phase));}
   throw new JudgingError('Endpoint not found.',404);
  }catch(e){json(res,e instanceof JudgingError?e.status:503,{error:e instanceof JudgingError?e.message:'Judging service is temporarily unavailable. No funds were moved.'});}
 };
}
