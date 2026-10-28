// Private native storage. No wallet access, remote fetches, archive extraction or executable uploads.
import {constants as flags} from 'node:fs';
import * as fs from 'node:fs/promises';
import {resolve,dirname,parse,join} from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {sessionUser} from './accounts.mjs';
import {digitalSellers} from './digital-config.mjs';
import {isSaplingTestnet} from '../scanner/invoice.mjs';
export const LIMITS=Object.freeze({file:10*1024**2,preview:2*1024**2,account:48*1024**2,total:256*1024**2,reserve:1024**3,pixels:4*1024**2});
const formats={png:'image/png',jpg:'image/jpeg',stl:'model/stl'},categories=['Digital Art','Digital Items','Digital Collectibles'];
const idPattern=/^[a-f0-9]{32}$/;
class FileError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const deny=(message,status=400)=>{throw new FileError(message,status);};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...(status===429?{'Retry-After':'30'}:{})});res.end(JSON.stringify(data));}
async function smallBody(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>8192)deny('Request too large.',413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{deny('Invalid JSON.');}}
function fields(value,names){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(k=>!names.includes(k)))deny('Unexpected fields.');}
export async function privateRoot(path){
 if(!path||!parse(path).root||resolve(path)!==path)deny('Private digital storage is not configured.',503);
 await fs.mkdir(path,{recursive:true,mode:0o700});
 let current=path;while(true){const s=await fs.lstat(current);if(s.isSymbolicLink()||!s.isDirectory())deny('Private digital storage is unavailable.',503);if(dirname(current)===current)break;current=dirname(current);}
 for(const name of ['objects','tmp']){const p=join(path,name);await fs.mkdir(p,{mode:0o700,recursive:true});const s=await fs.lstat(p);if(s.isSymbolicLink()||!s.isDirectory())deny('Private storage unavailable.',503);}
 return path;
}
async function hashFile(handle,size){const hash=createHash('sha256');const buffer=Buffer.alloc(65536);let offset=0;while(offset<size){const {bytesRead}=await handle.read(buffer,0,Math.min(buffer.length,size-offset),offset);if(!bytesRead)deny('File unavailable.',503);hash.update(buffer.subarray(0,bytesRead));offset+=bytesRead;}return hash.digest('hex');}
let sharpPromise;
async function imageDecoder(){sharpPromise??=import('sharp').then(({default:sharp})=>{sharp.concurrency(1);sharp.cache({memory:16,files:0,items:8});return sharp;});return sharpPromise;}
export async function validateFile(path,format,kind,output){
 const handle=await fs.open(path,flags.O_RDONLY|flags.O_NOFOLLOW);let size;
 try{
  const stat=await handle.stat();size=stat.size;if(!stat.isFile()||!size||size>LIMITS.file)deny('Invalid file size.');
  const head=Buffer.alloc(Math.min(84,size));await handle.read(head,0,head.length,0);
  if(format==='stl'){
   if(kind==='preview'||size<134)deny('Use a PNG or JPEG preview.');
   const count=head.readUInt32LE(80);if(!count||count>200000||size!==84+50*count)deny('Only bounded binary STL meshes are supported.');
   const triangle=Buffer.alloc(50);
   for(let i=0;i<count;i++){await handle.read(triangle,0,50,84+i*50);for(let j=0;j<12;j++)if(!Number.isFinite(triangle.readFloatLE(j*4)))deny('Invalid STL coordinates.');if(triangle.readUInt16LE(48)!==0)deny('Colored/vendor STL extensions are unsupported.');}
  }else{
   if(format==='png'){
    if(head.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')deny('The contents are not PNG.');
    let offset=8;const chunk=Buffer.alloc(8);
    while(offset<size){if(offset+12>size)deny('Malformed PNG.');await handle.read(chunk,0,8,offset);const length=chunk.readUInt32BE(0),type=chunk.toString('ascii',4,8);if(offset+12+length>size||['acTL','fcTL','fdAT'].includes(type))deny('Animated or malformed PNG is unsupported.');offset+=length+12;if(type==='IEND'){if(length||offset!==size)deny('Trailing PNG data is unsupported.');break;}}
    if(offset!==size)deny('Malformed PNG.');
   }else if(format==='jpg'){
    const tail=Buffer.alloc(2);await handle.read(tail,0,2,size-2);if(head[0]!==255||head[1]!==216||tail[0]!==255||tail[1]!==217)deny('Malformed JPEG or trailing data.');
   }else deny('Unsupported format.');
  }
 }finally{await handle.close();}
 if(format!=='stl'){
  try{
  const sharp=await imageDecoder(),options={limitInputPixels:LIMITS.pixels,failOn:'warning',sequentialRead:true,animated:false};
  const meta=await sharp(path,options).metadata();if(!['png','jpeg'].includes(meta.format)||!meta.width||!meta.height||meta.pages>1)deny('Only still raster images are supported.');
  await sharp(path,options).stats(); // Full bounded decode, not just extension/magic/header validation.
  if(kind==='preview'){await sharp(path,options).rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).png().toFile(output);const stat=await fs.stat(output);if(stat.size>LIMITS.preview)deny('Processed preview exceeds 2 MiB.');return {format:'png',mime:'image/png',bytes:stat.size};}
  }catch(error){if(error instanceof FileError)throw error;deny('The image could not be fully decoded as a bounded still PNG or JPEG.',415);}
 }
 return {format,mime:formats[format],bytes:size};
}
export async function verifyDraftFiles(db,id,user){
 const draft=db.prepare('SELECT * FROM digital_drafts WHERE id=? AND owner_id=?').get(id,user);if(!draft)deny('Digital draft unavailable.',409);
 const base=await privateRoot(process.env.VEIL_DIGITAL_ROOT);
 for(const assetId of [draft.preview_id,draft.file_id]){
  if(!idPattern.test(assetId))deny('Digital file unavailable.',503);
  const asset=db.prepare("SELECT * FROM digital_assets WHERE id=? AND owner_id=? AND state='complete'").get(assetId,user);if(!asset)deny('Digital file unavailable.',503);
  const file=await fs.open(join(base,'objects',assetId),flags.O_RDONLY|flags.O_NOFOLLOW);
  try{const stat=await file.stat();if(!stat.isFile()||stat.size!==asset.bytes||await hashFile(file,stat.size)!==asset.sha256)deny('Digital file unavailable.',503);}finally{await file.close();}
 }
 return true;
}
export function digitalHandler(db,origin,{root=process.env.VEIL_DIGITAL_ROOT,limits=LIMITS}={}){
 const expected=new URL(origin),rates=new Map(),running=new Map(),uploadingUsers=new Set();let uploads=0,downloads=0;
 function configuredReceiver(id){try{const r=JSON.parse(digitalSellers())[id];return isSaplingTestnet(r)?r:null;}catch{return null;}}
 function requestFor(id){return db.prepare('SELECT receiver,requested_at,updated_at FROM digital_seller_requests WHERE account_id=?').get(id)??null;}
 function receiver(id){const configured=configuredReceiver(id),requested=requestFor(id);return configured&&(!requested||requested.receiver===configured)?configured:null;}
 function setupFor(id){const requested=requestFor(id),approved=receiver(id);return {state:approved?'ready':requested?'pending':'not-requested',address:requested?.receiver??null,updatedAt:requested?.updated_at??null};}
 function throttle(user,preview=false){user=(preview?'preview:':'operation:')+user;const now=Date.now();for(const [k,v]of rates)if(v.until<now)rates.delete(k);let r=rates.get(user);if(!r){if(rates.size>=200)deny('Please retry shortly.',429);r={count:0,until:now+600000};rates.set(user,r);}if(++r.count>(preview?240:40))deny('Please wait before retrying.',429);}
 const info=l=>({auctionId:l.auction_id,category:l.category,license:l.license,edition:l.edition,provenance:l.provenance,bytes:l.bytes,format:l.format,previewUrl:'/api/digital/preview/'+l.auction_id});
 async function upload(req,res,user,url){
  if(!receiver(user))deny('Automatic delivery is not enabled for your own verified receiver.',403);
  if(process.env.VEIL_DIGITAL_PUBLISHING_ENABLED!=='1')deny('New uploads are paused. Existing downloads remain available.',503);
  const kind=url.searchParams.get('kind'),format=url.searchParams.get('format');if(!['preview','deliverable'].includes(kind)||!formats[format]||(kind==='preview'&&format==='stl'))deny('Choose PNG/JPEG, or binary STL for the deliverable.');
  if(req.headers['content-type']!=='application/octet-stream')deny('Use a binary upload.',415);
  const length=Number(req.headers['content-length']),limit=kind==='preview'?limits.preview:limits.file;
  if(!Number.isSafeInteger(length)||length<1)deny('A content length is required.',411);if(length>limit)deny('File exceeds the upload limit.',413);
  throttle(user);const base=await privateRoot(root),disk=await fs.statfs(base),pending=db.prepare("SELECT COALESCE(SUM(reserved_bytes),0) n FROM digital_assets WHERE state='uploading'").get().n;
  if(disk.bavail*disk.bsize-pending-limit<limits.reserve)deny('Storage reserve reached. Uploads are temporarily unavailable.',507);
  const id=randomBytes(16).toString('hex'),now=Date.now();
  const result=db.prepare(`INSERT INTO digital_assets(id,owner_id,kind,format,mime,state,reserved_bytes,created_at)
   SELECT ?,?,?,?,?,'uploading',?,? WHERE (SELECT COALESCE(SUM(reserved_bytes),0) FROM digital_assets WHERE owner_id=?) + ? <= ?
   AND (SELECT COALESCE(SUM(reserved_bytes),0) FROM digital_assets) + ? <= ?
   AND (SELECT COUNT(*) FROM digital_assets WHERE owner_id=?)<32`).run(id,user,kind,format,formats[format],limit,now,user,limit,limits.account,limit,limits.total,user);
  if(!result.changes)deny('Upload quota reached. Remove unused drafts or contact the operator.',429);
  const temp=join(base,'tmp',id+'.part'),processed=join(base,'tmp',id+'.preview'),destination=join(base,'objects',id);let opened=false,linked=false,committed=false;
  try{
   const handle=await fs.open(temp,flags.O_WRONLY|flags.O_CREAT|flags.O_EXCL|flags.O_NOFOLLOW,0o600);opened=true;let bytes=0;
   try{for await(const chunk of req){bytes+=chunk.length;if(bytes>length||bytes>limit)deny('Upload exceeded its declared limit.',413);await handle.write(chunk);}if(bytes!==length)deny('Upload was incomplete.');await handle.sync();}finally{await handle.close();}
   const valid=await validateFile(temp,format,kind,processed),source=kind==='preview'?processed:temp;
   const file=await fs.open(source,flags.O_RDWR|flags.O_NOFOLLOW);let hash;try{hash=await hashFile(file,valid.bytes);await file.sync();}finally{await file.close();}
   await fs.link(source,destination);linked=true;await fs.chmod(destination,0o600);if(process.platform!=='win32'){const dir=await fs.open(join(base,'objects'),'r');try{await dir.sync();}finally{await dir.close();}}
   db.prepare("UPDATE digital_assets SET state='complete',bytes=?,reserved_bytes=?,sha256=?,format=?,mime=? WHERE id=? AND owner_id=? AND state='uploading'").run(valid.bytes,valid.bytes,hash,valid.format,valid.mime,id,user);committed=true;
   return {asset:{id,kind,format:valid.format,bytes:valid.bytes},note:'Validated file; no malware scanning is claimed. Preview metadata is removed.'};
  }catch(error){if(!committed){db.prepare('DELETE FROM digital_assets WHERE id=?').run(id);if(linked)await fs.unlink(destination).catch(()=>{});}throw error;}
  finally{if(opened)await fs.unlink(temp).catch(()=>{});await fs.unlink(processed).catch(()=>{});}
 }
 async function download(req,res,user,id,preview=false){
  const l=db.prepare('SELECT l.*,a.owner_id,a.title,a.result FROM digital_listings l JOIN auctions a ON a.id=l.auction_id WHERE l.auction_id=?').get(id);if(!l)deny('Digital listing not found.',404);
  if(!preview){
   const e=db.prepare('SELECT * FROM digital_entitlements WHERE auction_id=?').get(id);
   if(l.owner_id!==user&&(!e||e.winner_id!==user))deny('This download is available only to the seller or entitled winner.',403);
   if(l.owner_id!==user&&(e.state!=='active'||e.result_binding!==l.result||e.version_id!==l.version_id||e.file_id!==l.file_id||e.license!==l.license))deny('Download suspended pending operator review.',409);
  }
  if(!['GET','HEAD'].includes(req.method))deny('Method not allowed.',405);if(req.headers.range)deny('Range requests are unsupported; retry the complete file.',416);
  throttle(user,preview);
  const asset=db.prepare('SELECT * FROM digital_assets WHERE id=?').get(preview?l.preview_id:l.file_id);if(!asset||!idPattern.test(asset.id))deny('File unavailable.',503);
  const base=await privateRoot(root);let handle;
  try{handle=await fs.open(join(base,'objects',asset.id),flags.O_RDONLY|flags.O_NOFOLLOW);const s=await handle.stat();if(!s.isFile()||s.size!==asset.bytes||await hashFile(handle,s.size)!==asset.sha256||(!preview&&asset.sha256!==l.private_sha256))deny('File unavailable.',503);}
  catch{await handle?.close();if(!preview)db.prepare("INSERT INTO digital_events(auction_id,event,recorded_at) VALUES(?,'download-unavailable',?)").run(id,Date.now());console.error('VEIL digital file unavailable; operator integrity review required.');deny('The frozen file is temporarily unavailable. No download has been served.',503);}
  let served=false;
  try{
   res.writeHead(200,{'Content-Type':asset.mime,'Content-Length':asset.bytes,'Content-Disposition':(preview?'inline':'attachment')+'; filename="veil-'+(preview?'preview-':'download-')+id.slice(0,8)+'.'+asset.format+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Accept-Ranges':'none','Content-Security-Policy':"default-src 'none'; sandbox"});
   if(req.method==='HEAD'){res.end();return;}
   await pipeline(handle.createReadStream({start:0,end:asset.bytes-1,autoClose:false}),res);served=true;
  }finally{
   await handle.close();
   if(!preview&&req.method!=='HEAD')db.prepare('INSERT INTO digital_events(auction_id,event,recorded_at,bytes) VALUES(?,?,?,?)').run(id,served?'download-served':'download-incomplete',Date.now(),served?asset.bytes:null);
  }
 }
 return async function handle(req,res,next){
  const url=new URL(req.url,expected);if(!url.pathname.startsWith('/api/digital/'))return next();
  try{
   const user=sessionUser(db,req.headers.cookie??'');if(!user)deny('Authentication required.',401);const who=user.userId;
   if(!['GET','HEAD'].includes(req.method)&&(req.headers.origin!==expected.origin||req.headers['sec-fetch-site']==='cross-site'))deny('Cross-site requests are not accepted.',403);
   if(url.pathname==='/api/digital/config'&&req.method==='GET'){const address=receiver(who),available=!!root&&process.env.VEIL_DIGITAL_PUBLISHING_ENABLED==='1';return json(res,200,{available,eligible:available&&!!address,address:available?address:null,setup:setupFor(who),categories,limits,explanation:'Seller setup is reviewed before paid listings are enabled. Existing auctions and downloads remain available.'});}
   if(url.pathname==='/api/digital/receiver-request'&&req.method==='POST'){
    if(!root||process.env.VEIL_DIGITAL_PUBLISHING_ENABLED!=='1')deny('Seller setup requests are temporarily unavailable.',503);
    throttle(who);if(!req.headers['content-type']?.startsWith('application/json'))deny('JSON required.',415);const b=await smallBody(req);fields(b,['address']);
    if(typeof b.address!=='string'||b.address.length>200||!isSaplingTestnet(b.address.trim()))deny('Enter a valid Sapling testnet receiving address.');const address=b.address.trim(),configured=configuredReceiver(who),existing=requestFor(who);
    if(configured&&configured!==address)deny('A receiver is already in use for paid listings. Contact the operator before changing it.',409);
    let map={};try{map=JSON.parse(digitalSellers());}catch{}if(Object.entries(map).some(([id,value])=>id!==who&&value===address))deny('This receiver is already assigned to another seller.',409);
    if(existing?.receiver===address)return json(res,200,{setup:setupFor(who)});
    if(existing&&Date.now()-existing.updated_at<600000)deny('You can update this request after 10 minutes.',429);
    if(!existing&&db.prepare('SELECT COUNT(*) n FROM digital_seller_requests').get().n>=200)deny('Seller setup queue is full. Retry later.',429);
    try{db.prepare(`INSERT INTO digital_seller_requests(account_id,receiver,requested_at,updated_at) VALUES(?,?,?,?)
     ON CONFLICT(account_id) DO UPDATE SET receiver=excluded.receiver,updated_at=excluded.updated_at`).run(who,address,Date.now(),Date.now());}
    catch{deny('This receiver is already assigned to another seller.',409);}
    return json(res,201,{setup:setupFor(who)});
   }
   if(!root)deny('Private digital storage is unavailable.',503);
   if(url.pathname==='/api/digital/uploads'&&req.method==='POST'){
    if(uploads>=2||uploadingUsers.has(who))deny('An upload is already running. Retry shortly.',429);
    uploads++;uploadingUsers.add(who);let result;try{result=await upload(req,res,who,url);}finally{uploads--;uploadingUsers.delete(who);}return json(res,201,result);
   }
   if(url.pathname==='/api/digital/drafts'&&req.method==='POST'){
    if(process.env.VEIL_DIGITAL_PUBLISHING_ENABLED!=='1')deny('New publishing is paused. Existing downloads remain available.',503);
    const address=receiver(who);if(!address)deny('Your own receiver is not eligible for automatic delivery.',403);if(!req.headers['content-type']?.startsWith('application/json'))deny('JSON required.',415);throttle(who);
    const b=await smallBody(req);fields(b,['previewId','fileId','category','license','edition','provenance']);b.edition??='';
    if(!categories.includes(b.category)||typeof b.license!=='string'||b.license.trim().length<10||b.license.length>4000||typeof b.edition!=='string'||b.edition.length>200||typeof b.provenance!=='string'||b.provenance.trim().length<10||b.provenance.length>1000||!idPattern.test(b.previewId)||!idPattern.test(b.fileId))deny('Choose a digital category, complete files and clear license terms.');
    for(const [id,kind]of [[b.previewId,'preview'],[b.fileId,'deliverable']]){const a=db.prepare("SELECT id FROM digital_assets WHERE id=? AND owner_id=? AND kind=? AND state='complete'").get(id,who,kind);if(!a)deny('Complete your own validated uploads first.',409);}
    const id=randomUUID();db.prepare('INSERT INTO digital_drafts VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,who,b.previewId,b.fileId,b.category,b.license.trim(),b.edition.trim(),b.provenance.trim(),address,Date.now());return json(res,201,{draftId:id});
   }
   if(url.pathname==='/api/digital/purchases'&&req.method==='GET'){
    const rows=db.prepare('SELECT l.*,a.title,e.state,e.granted_at FROM digital_entitlements e JOIN digital_listings l ON l.auction_id=e.auction_id JOIN auctions a ON a.id=l.auction_id WHERE e.winner_id=? ORDER BY e.granted_at DESC LIMIT 100').all(who);return json(res,200,{purchases:rows.map(l=>({...info(l),title:l.title,state:l.state,grantedAt:l.granted_at,downloadUrl:'/api/digital/download/'+l.auction_id}))});
   }
   const m=url.pathname.match(/^\/api\/digital\/(listing|preview|download)\/([a-f0-9-]{36})$/);
   if(m){if(m[1]==='preview'||m[1]==='download'){
    if(downloads>=6||(running.get(who)??0)>=(m[1]==='preview'?6:2))deny('Please retry your download shortly.',429);
    downloads++;running.set(who,(running.get(who)??0)+1);try{return await download(req,res,who,m[2],m[1]==='preview');}finally{downloads--;const n=(running.get(who)??1)-1;if(n)running.set(who,n);else running.delete(who);}
   }if(req.method!=='GET')deny('Method not allowed.',405);const l=db.prepare('SELECT l.*,a.owner_id,a.result FROM digital_listings l JOIN auctions a ON a.id=l.auction_id WHERE l.auction_id=?').get(m[2]);if(!l)deny('Legacy listing has no protected digital delivery.',404);const e=db.prepare('SELECT * FROM digital_entitlements WHERE auction_id=? AND winner_id=?').get(m[2],who);
    const authorized=l.owner_id===who||!!e&&e.state==='active'&&e.result_binding===l.result&&e.version_id===l.version_id&&e.file_id===l.file_id&&e.license===l.license;
    let available=false;
    if(authorized){
     if(downloads>=6)deny('Please retry shortly.',429);throttle(who);downloads++;
     let file;try{const base=await privateRoot(root);file=await fs.open(join(base,'objects',l.file_id),flags.O_RDONLY|flags.O_NOFOLLOW);const stat=await file.stat();available=stat.isFile()&&stat.size===l.bytes&&await hashFile(file,stat.size)===l.private_sha256;}catch{}finally{await file?.close();downloads--;}
     if(!available)console.error('VEIL digital file unavailable; operator integrity review required.');
    }
    return json(res,200,{...info(l),isSeller:l.owner_id===who,entitlement:e?{state:e.state,grantedAt:e.granted_at}:null,accessState:authorized?(available?'available':'unavailable'):e?'suspended':'pending',downloadAvailable:available,downloadUrl:'/api/digital/download/'+m[2]});}
   deny('Digital endpoint not found.',404);
  }catch(error){if(res.headersSent){res.destroy();return;}json(res,error instanceof FileError?error.status:503,{error:error instanceof FileError?error.message:'Digital storage is temporarily unavailable. No access was granted by this request.'});}
 };
}
