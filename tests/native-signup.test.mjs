import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createServer} from 'node:http';
import {initializeDatabase,openDatabase} from '../runtime/database.mjs';
import {createAccount,sessionUser,safeReturn,listAccounts} from '../runtime/accounts.mjs';
import {authenticationHandler} from '../runtime/http-auth.mjs';
import {loopbackFetch} from './loopback-http.mjs';
async function setup(){const dir=await mkdtemp(join(tmpdir(),'veil-signup-')),path=join(dir,'db');initializeDatabase(path,resolve('drizzle'));const db=openDatabase(path),admin=await createAccount(db,'operator','operator-password-for-tests');const handle=authenticationHandler(db,'https://veil.example',{adminAccountIds:[admin]});const server=createServer((q,s)=>handle(q,s,(req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({path:req.url,forged:req.headers['oai-authenticated-user-id']??null,bearer:req.headers.authorization??null}));}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const request=(path,init={})=>loopbackFetch(origin+path,{...init,redirect:'manual',headers:{Host:'veil.example',...init.headers}});const post=(path,data,headers={})=>request(path,{method:'POST',headers:{Origin:'https://veil.example','Content-Type':'application/x-www-form-urlencoded',...headers},body:data instanceof URLSearchParams?data:new URLSearchParams(data)});return {db,request,post,close:async()=>{await new Promise(r=>server.close(r));db.close();}};}
const good={username:'New.User',password:'a-long-signup-password',confirm_password:'a-long-signup-password'};
const cookie=r=>r.headers.get('set-cookie').split(';')[0];
test('public registration normalizes, signs in, preserves destinations and cannot assign privileges',async()=>{const t=await setup();try{
 const root=await t.request('/');assert.equal(root.status,303);assert.equal(root.headers.get('location'),'/login?return_to=%2F');
 assert.equal((await t.request('/api/scanner/jobs',{headers:{Authorization:'Bearer retained','oai-authenticated-user-id':'forged'}})).status,200);const scanner=await (await t.request('/api/scanner/jobs',{headers:{Authorization:'Bearer retained','oai-authenticated-user-id':'forged'}})).json();assert.equal(scanner.forged,null);assert.equal(scanner.bearer,'Bearer retained');
 const denied=await t.post('/signup',{...good,role:'admin'});assert.equal(denied.status,400);assert.equal(t.db.prepare('select count(*) n from veil_accounts where username=?').get('new.user').n,0);
 const r=await t.post('/signup',{...good,return_to:'/auctions?view=mine#latest'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/auctions?view=mine#latest');const c=cookie(r),user=sessionUser(t.db,c);assert.equal(user.displayName,'new.user');assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);
 assert.equal((await t.request('/',{headers:{Cookie:c}})).status,200);for(const path of ['/login','/signup'])assert.equal((await t.request(path,{headers:{Cookie:c}})).headers.get('location'),'/');
 assert.equal((await t.request('/admin/accounts',{headers:{Cookie:c}})).status,403);
 const admin=await t.post('/login',{username:'operator',password:'operator-password-for-tests'});const listing=await t.request('/admin/accounts',{headers:{Cookie:cookie(admin)}});assert.equal(listing.status,200);const html=await listing.text();assert.match(html,/new.user/);assert.doesNotMatch(html,/password_hash|token_hash|operator-password-for-tests/);assert.equal(listAccounts(t.db).length,2);
 const out=await t.post('/logout',{}, {Cookie:c});assert.equal(out.headers.get('location'),'/login');assert.equal(sessionUser(t.db,c),null);
 }finally{await t.close();}});
test('signup rejects invalid input, mismatch, duplicate fields, duplicate usernames and CSRF',async()=>{const t=await setup();try{
 for(const data of [{...good,username:'ab'},{...good,password:'short',confirm_password:'short'},{...good,password:'x'.repeat(129),confirm_password:'x'.repeat(129)},{...good,confirm_password:'different-password'}])assert.equal((await t.post('/signup',data)).status,400);
 assert.equal((await t.post('/signup',new URLSearchParams([...Object.entries(good),['username','second-user']]))).status,400);
 for(const origin of ['', 'null','https://evil.example'])assert.equal((await t.post('/signup',good,{Origin:origin})).status,403);
 const results=await Promise.all([t.post('/signup',good),t.post('/signup',{...good,username:'new.user'})]);assert.deepEqual(results.map(r=>r.status).sort(),[303,400]);assert.match(await results.find(r=>r.status===400).text(),/username is unavailable/);assert.equal(t.db.prepare('select count(*) n from veil_accounts where username=?').get('new.user').n,1);
 assert.equal((await t.post('/login',{username:'new.user',password:'incorrect-password'})).status,401);
 const ok=await t.post('/login',{username:'NEW.USER',password:good.password,return_to:'https://evil.example'});assert.equal(ok.status,303);assert.equal(ok.headers.get('location'),'/');
 }finally{await t.close();}});
test('signup and login abuse counters are bounded and signup defaults to ordinary access',async()=>{const t=await setup();try{
 for(let i=0;i<30;i++)assert.equal((await t.post('/signup',{username:'ab',password:'short',confirm_password:'short'})).status,400);
 assert.equal((await t.post('/signup',good)).status,429);
 for(let i=0;i<5;i++)assert.equal((await t.post('/login',{username:'missing',password:'wrong'})).status,401);
 assert.equal((await t.post('/login',{username:'missing',password:'wrong'})).status,429);
 for(const path of ['/signup','/login']){const r=await t.request(path);const html=await r.text();assert.match(html,/autocomplete="(?:new|current)-password"/);assert.match(html,/data-toggle=/);assert.match(r.headers.get('content-security-policy'),/script-src 'nonce-/);assert.doesNotMatch(html,/<input[^>]+name="(?:password|confirm_password)"[^>]+maxlength=/);}
 }finally{await t.close();}});
test('redirect validation rejects external, encoded, control and authentication-loop destinations',()=>{
 for(const path of ['https://evil.example','//evil.example','/%2f%2fevil.example','/%5cevil.example','/login','/signup?return_to=/','/a/../logout','/%6cogin','/x%0d%0aLocation:evil','/\\evil'])assert.equal(safeReturn(path),'/');assert.equal(safeReturn('/admin/accounts?after=user#accounts'),'/admin/accounts?after=user#accounts');
});