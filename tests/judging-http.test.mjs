import test from'node:test';import assert from'node:assert/strict';import{mkdtemp}from'node:fs/promises';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{createServer}from'node:http';
import{initializeDatabase,openDatabase}from'../runtime/database.mjs';import{createAccount,createSession,sessionCookie}from'../runtime/accounts.mjs';import{judgingHandler}from'../runtime/judging-http.mjs';
test('native judging endpoints keep private activation, reauthentication, CSRF, role and bounded-abuse guards',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veil-judge-http-')),path=join(dir,'db.sqlite');initializeDatabase(path,resolve('drizzle'));const db=openDatabase(path),a=await createAccount(db,'judge.alpha','judge-alpha-password'),b=await createAccount(db,'judge.beta','judge-beta-password'),cookie=sessionCookie(createSession(db,a)).split(';')[0],other=sessionCookie(createSession(db,b)).split(';')[0];
 const handler=judgingHandler(db,'https://veil.example'),server=createServer((req,res)=>handler(req,res,()=>{res.writeHead(418);res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const request=(path,body,headers={})=>fetch(url+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:'https://veil.example','Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 try{
  assert.equal((await request('/api/judging/wallet',undefined,{Cookie:''})).status,401);
  assert.equal((await request('/api/judging/wallet/activate',{}, {Origin:'https://evil.example'})).status,403);
  assert.equal((await request('/api/judging/wallet/activate',{accountId:b,role:'admin'})).status,400);
  const activation=await request('/api/judging/wallet/activate',{});assert.equal(activation.status,202);assert.equal((await activation.json()).balanceZatoshis,null);
  assert.equal((await(await request('/api/judging/wallet',undefined,{Cookie:other})).json()).state,'not-activated');
  assert.equal((await request('/api/judging/wallet/backup',{password:'wrong'})).status,403);
  const backup=await request('/api/judging/wallet/backup',{password:'judge-alpha-password'});assert.equal(backup.status,503);assert.doesNotMatch(await backup.text(),/secret-extended|mnemonic|seedfp|privateKey/);
  assert.equal((await request('/api/judging/worker/claim',{})).status,403);
  assert.equal((await request('/api/judging/request-edition',{slug:'first-seal'})).status,409);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM judging_edition_requests').get().n,0);
  assert.equal((await request('/api/judging/wallet/pay',{pay:true})).status,503);
  assert.equal((await request('/api/scanner/jobs',{})).status,418,'Judging middleware must not intercept scanner bearer-token routes.');
  for(let n=0;n<25;n++)await request('/api/judging/wallet/activate',{});assert.equal((await request('/api/judging/wallet/activate',{})).status,429);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM judging_wallet_requests').get().n,1);
 }finally{await new Promise(r=>server.close(r));db.close();}
});

test('funding HTTP distinguishes a new queued grant from a retained cooldown result',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veil-fund-feedback-')),path=join(dir,'db.sqlite');initializeDatabase(path,resolve('drizzle'));const db=openDatabase(path),id=await createAccount(db,'fund.feedback','fund-feedback-password'),cookie=sessionCookie(createSession(db,id)).split(';')[0];
 let result={id:'synthetic-retained',state:'confirmed',created:false,reason:'cooldown',nextEligibleAt:1900000000000};
 const handler=judgingHandler(db,'https://veil.example',{managed:async(action,user)=>{assert.equal(action,'fund');assert.equal(user,id);return result;}}),server=createServer((req,res)=>handler(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=()=>fetch('http://127.0.0.1:'+server.address().port+'/api/judging/wallet/fund',{method:'POST',headers:{Cookie:cookie,Origin:'https://veil.example','Content-Type':'application/json'},body:'{}'});
 try{
 const retained=await request();assert.equal(retained.status,200);assert.deepEqual(await retained.json(),result);
 result={...result,state:'queued',created:true,reason:'queued'};const queued=await request();assert.equal(queued.status,202);assert.equal((await queued.json()).created,true);
 }finally{await new Promise(r=>server.close(r));db.close();}
});
