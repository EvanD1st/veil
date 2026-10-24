import {authenticate,registerAccount,validateAccount,sessionUser,sessionCookie,revokeSession,safeReturn,listAccounts} from './accounts.mjs';
import {authPage,document,escape,sendPage} from './auth-pages.mjs';
async function form(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('The form is too large.');chunks.push(chunk);}return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));}
const redirect=(res,location,cookie)=>{res.writeHead(303,{Location:location,'Cache-Control':'no-store','Referrer-Policy':'same-origin',...(cookie?{'Set-Cookie':cookie}:{})});res.end();};
export function authenticationHandler(db,origin,{allowLoopbackHttp=false,adminAccountIds=[]}={}){
 const expected=new URL(origin),privateTunnel=allowLoopbackHttp&&expected.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(expected.hostname);
 if((expected.protocol!=='https:'&&!privateTunnel)||expected.pathname!=='/'||expected.search||expected.hash||expected.username||expected.password)throw Error('Set a clean HTTPS VEIL_PUBLIC_ORIGIN. HTTP requires explicit private-loopback mode.');
 if(!Array.isArray(adminAccountIds)||adminAccountIds.length>100||adminAccountIds.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9._:-]{1,200}$/.test(id)))throw Error('Invalid administrator account allowlist.');
 const admins=new Set(adminAccountIds),attempts=new Map();let hashing=0,signupAttempts=0,signupWindow=0;
 return async function handle(req,res,next){
  for(const key of Object.keys(req.headers))if(key.startsWith('oai-authenticated-')||key.startsWith('x-forwarded-'))delete req.headers[key];
  const raw=[];for(let i=0;i<req.rawHeaders.length;i+=2)if(!/^(oai-authenticated-|x-forwarded-)/i.test(req.rawHeaders[i]))raw.push(req.rawHeaders[i],req.rawHeaders[i+1]);req.rawHeaders=raw;
  if(req.headers.host!==expected.host){sendPage(res,400,document('Invalid request','<p>Invalid host.</p>'));return;}
  req.headers['x-forwarded-proto']=expected.protocol.slice(0,-1);
  const url=new URL(req.url,expected),aliases={'/signin-with-chatgpt':'login','/signout-with-chatgpt':'logout'},kind=aliases[url.pathname]??({'/login':'login','/signup':'signup','/logout':'logout'}[url.pathname]),user=sessionUser(db,req.headers.cookie??'');
  if(!kind){
   if(url.pathname==='/admin/accounts'){
    if(!user){redirect(res,'/login?return_to='+encodeURIComponent('/admin/accounts'+url.search));return;}
    if(!admins.has(user.userId)){sendPage(res,403,document('Access denied','<p>Administrator access required.</p>'));return;}
    if(req.method!=='GET'){sendPage(res,405,document('Method not allowed',''),{Allow:'GET'});return;}
    try{const rows=listAccounts(db,url.searchParams.get('after')??''),shown=rows.slice(0,50);sendPage(res,200,document('Accounts',`<p>Ordinary registered accounts. Passwords and sessions are never listed.</p><table><thead><tr><th>Username</th><th>Created (UTC)</th><th>Status</th></tr></thead><tbody>${shown.map(r=>`<tr><td>${escape(r.username)}</td><td>${escape(new Date(r.created_at).toISOString())}</td><td>${r.disabled?'Disabled':'Active'}</td></tr>`).join('')}</tbody></table>${rows.length>50?`<a href="/admin/accounts?after=${encodeURIComponent(shown[49].username)}">Next page</a>`:''}<a href="/">Back to auctions</a>`));}catch{sendPage(res,400,document('Invalid request','<p>Invalid account cursor.</p>'));}return;
   }
   const api=url.pathname==='/api'||url.pathname.startsWith('/api/'),asset=/^\/(assets\/|images\/|zk\/|favicon\.)/.test(url.pathname);
   if(!user&&!api&&!asset&&['GET','HEAD'].includes(req.method)){redirect(res,'/login?return_to='+encodeURIComponent(safeReturn(req.url)));return;}
   next(req,res);return;
  }
  const returning=safeReturn(url.searchParams.get('return_to')??'/');
  if(req.method==='GET'){
   if(user&&kind!=='logout'){redirect(res,'/');return;}
   if(aliases[url.pathname]){redirect(res,'/'+kind+(kind==='login'?'?return_to='+encodeURIComponent(returning):''));return;}
   sendPage(res,200,authPage(kind,returning));return;
  }
  if(req.method!=='POST'){sendPage(res,405,document('Method not allowed',''),{Allow:'GET, POST'});return;}
  if(req.headers.origin!==expected.origin||req.headers['sec-fetch-site']==='cross-site'||!String(req.headers['content-type']??'').startsWith('application/x-www-form-urlencoded')){sendPage(res,403,document('Request rejected','<p>This form must be submitted from VEIL.</p>'));return;}
  let destination=returning,username='';
  try{
   const data=await form(req);destination=safeReturn(data.get('return_to')??returning);
   if(kind==='logout'){revokeSession(db,req.headers.cookie);redirect(res,'/login',sessionCookie(''));return;}
   if(user){redirect(res,'/');return;}
   const allowed=kind==='signup'?['username','password','confirm_password','return_to']:['username','password','return_to'];
   if([...data.keys()].some(k=>!allowed.includes(k))||[...new Set(data.keys())].some(k=>data.getAll(k).length!==1))throw Error('Unexpected or repeated form fields.');
   username=(data.get('username')??'').toLowerCase();const now=Date.now();
   for(const [key,value]of attempts)if(value.until<=now)attempts.delete(key);
   if(kind==='signup'){
    if(now>=signupWindow){signupAttempts=0;signupWindow=now+600000;}
    if(signupAttempts>=30||hashing>=2){sendPage(res,429,authPage(kind,destination,'Please wait before creating another account.',username),{'Retry-After':'600'});return;}
    signupAttempts++;
    validateAccount(username,data.get('password'));
    if(data.get('password')!==data.get('confirm_password'))throw Error('Passwords do not match.');
    hashing++;let token;try{token=await registerAccount(db,username,data.get('password'));}catch(error){if(error.code==='ERR_SQLITE_ERROR'&&/UNIQUE constraint failed: veil_accounts.username/.test(error.message))throw Error('That username is unavailable. Choose another.');throw error;}finally{hashing--;}
    redirect(res,destination,sessionCookie(token));return;
   }
   const key=username.slice(0,41),counter=attempts.get(key)??{count:0,until:now+600000};
   if(counter.count>=5||hashing>=2||(!attempts.has(key)&&attempts.size>=200)){sendPage(res,429,authPage(kind,destination,'Please wait before trying to log in again.',username),{'Retry-After':'60'});return;}
   counter.count++;attempts.set(key,counter);hashing++;let token;try{token=await authenticate(db,username,data.get('password')??'');}finally{hashing--;}
   if(!token){sendPage(res,401,authPage(kind,destination,'Invalid username or password.',username));return;}
   attempts.delete(key);redirect(res,destination,sessionCookie(token));
  }catch(error){const known=/^(Use |Passwords do not match\.|That username is unavailable\.|Unexpected or repeated form fields\.|The form is too large\.)/.test(error.message??'');sendPage(res,400,authPage(kind,destination,known?error.message:'The request could not be completed. Please try again.',username));}
 };
}
