import { authenticate, sessionCookie, revokeSession, safeReturn } from './accounts.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function html(title,body) {return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · VEIL</title><style>body{background:#f5f4ee;color:#20382c;font:17px system-ui;margin:0;padding:24px}main{max-width:380px;margin:10vh auto;background:#fff;border:1px solid #dce3d8;border-radius:20px;padding:32px}h1{font:36px Georgia}label{display:block;margin:18px 0}input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #899c8a;border-radius:8px}button{background:#254d39;color:white;cursor:pointer}a{color:#254d39}p{line-height:1.5}input:focus,button:focus,a:focus{outline:3px solid #adbb82;outline-offset:3px}</style><main><a href="/">VEIL</a><h1>${title}</h1>${body}</main></html>`;}
function send(res,status,body,headers={}) {res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",...headers});res.end(body);}
async function form(req) {let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2048)throw Error('Body too large');}return new URLSearchParams(text);}
export function authenticationHandler(db,origin,{allowLoopbackHttp=false}={}) {
 const expected=new URL(origin),privateTunnel=allowLoopbackHttp&&expected.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(expected.hostname);
 if((expected.protocol!=='https:'&&!privateTunnel)||expected.pathname!=='/'||expected.search||expected.hash||expected.username)throw Error('Set a clean HTTPS VEIL_PUBLIC_ORIGIN. HTTP requires explicit private-loopback mode.');
 const attempts=new Map();let hashing=0;
 return async function handle(req,res,next) {
  // Neither arbitrary authenticated-user headers nor forwarded-host/proto values authenticate Node requests.
  for(const key of Object.keys(req.headers))if(key.startsWith('oai-authenticated-')||key.startsWith('x-forwarded-'))delete req.headers[key];
  const raw=[];for(let i=0;i<req.rawHeaders.length;i+=2)if(!/^(oai-authenticated-|x-forwarded-)/i.test(req.rawHeaders[i]))raw.push(req.rawHeaders[i],req.rawHeaders[i+1]);req.rawHeaders=raw;
  if(req.headers.host!==expected.host){send(res,400,'Invalid host.');return;}
  req.headers['x-forwarded-proto']=expected.protocol.slice(0,-1);
  const url=new URL(req.url,expected);
  if(!['/signin-with-chatgpt','/signout-with-chatgpt'].includes(url.pathname)){next(req,res);return;}
  const returning=safeReturn(url.searchParams.get('return_to')??'/');
  if(req.method==='GET'){
   const body=url.pathname==='/signin-with-chatgpt'?`<p>Sign in with your VEIL account.</p><form method="post"><input type="hidden" name="return_to" value="${escape(returning)}"><label>Username<input name="username" autocomplete="username" maxlength="40" required></label><label>Password<input name="password" type="password" autocomplete="current-password" maxlength="128" required></label><button>Sign in</button></form>`:`<p>End this browser session?</p><form method="post"><input type="hidden" name="return_to" value="${escape(returning)}"><button>Sign out</button></form>`;
   send(res,200,html(url.pathname==='/signin-with-chatgpt'?'Welcome back':'Sign out',body));return;
  }
  if(req.method!=='POST'){send(res,405,'Method not allowed.',{Allow:'GET, POST'});return;}
  if(req.headers.origin!==expected.origin||req.headers['sec-fetch-site']==='cross-site'||!String(req.headers['content-type']??'').startsWith('application/x-www-form-urlencoded')){send(res,403,'This form must be submitted from VEIL.');return;}
  try{
   const data=await form(req),destination=safeReturn(data.get('return_to')??'/');
   if(url.pathname==='/signout-with-chatgpt'){revokeSession(db,req.headers.cookie);send(res,303,'',{'Set-Cookie':sessionCookie(''),Location:destination});return;}
   const username=(data.get('username')??'').toLowerCase(),now=Date.now();
   for(const [key,value]of attempts)if(value.until<=now)attempts.delete(key);
   const counter=attempts.get(username)??{count:0,until:now+600000};
   if(counter.count>=5||hashing>=2||attempts.size>=200){send(res,429,'Please wait before trying to sign in again.',{'Retry-After':'60'});return;}
   counter.count++;attempts.set(username,counter);hashing++;
   let token;try{token=await authenticate(db,username,data.get('password')??'');}finally{hashing--;}
   if(!token){send(res,401,html('Could not sign in','<p>Check your username and password, then <a href="/signin-with-chatgpt">try again</a>.</p>'));return;}
   attempts.delete(username);send(res,303,'',{'Set-Cookie':sessionCookie(token),Location:destination});
  }catch{send(res,400,'The form could not be processed.');}
 };
}
