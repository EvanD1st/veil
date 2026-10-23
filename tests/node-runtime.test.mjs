import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat} from 'node:fs/promises';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{createServer}from'node:http';
import{initializeDatabase,openDatabase,d1Adapter}from'../runtime/database.mjs';
import{createAccount,authenticate,sessionUser,sessionCookie,revokeSession,COOKIE,safeReturn}from'../runtime/accounts.mjs';
import{authenticationHandler}from'../runtime/http-auth.mjs';
import{loopbackFetch as fetch}from'./loopback-http.mjs';
async function database(){const dir=await mkdtemp(join(tmpdir(),'veil-native-')),path=join(dir,'veil.sqlite');initializeDatabase(path,resolve('drizzle'));return {db:openDatabase(path),path};}
test('standalone migrations preserve D1 integer/atomic/constraint behavior and refuse overwrite',async()=>{
 const {db,path}=await database();try{assert.equal(db.prepare('SELECT COUNT(*) n FROM veil_migrations').get().n,5);assert.throws(()=>initializeDatabase(path,resolve('drizzle')));const d1=d1Adapter(db);
 await d1.prepare('CREATE TABLE adapter_test(id INTEGER PRIMARY KEY,value TEXT UNIQUE)').run();assert.equal((await d1.prepare('INSERT INTO adapter_test VALUES (?,?)').bind(1,'a').run()).meta.changes,1);assert.equal((await d1.prepare('SELECT * FROM adapter_test WHERE id=?').bind(1).first()).value,'a');assert.equal((await d1.prepare('SELECT * FROM adapter_test').all()).results.length,1);await assert.rejects(d1.prepare('INSERT INTO adapter_test VALUES (?,?)').bind(2,'a').run());
 }finally{db.close();}
});
test('real password verification, hashed expiring sessions, disabled accounts and logout',async()=>{
 const {db}=await database();try{const password='a-test-password-with-length',id=await createAccount(db,'seller',password);
 assert.equal(await authenticate(db,'seller','incorrect'),null);assert.equal(await authenticate(db,'unknown',password),null);
 const now=Date.now(),token=await authenticate(db,'seller',password,now),cookie=COOKIE+'='+token;
 assert.equal(sessionUser(db,cookie,now).userId,id);assert.equal(sessionUser(db,cookie,now+43200000),null);assert.equal(sessionUser(db,cookie+'; '+cookie,now),null);
 assert.notEqual(db.prepare('SELECT token_hash FROM veil_sessions').get().token_hash,token);assert.match(sessionCookie(token),/Secure; HttpOnly; SameSite=Strict/);
 db.prepare('UPDATE veil_accounts SET disabled=1').run();assert.equal(sessionUser(db,cookie),null);db.prepare('UPDATE veil_accounts SET disabled=0').run();revokeSession(db,cookie);assert.equal(sessionUser(db,cookie),null);
 }finally{db.close();}
});
test('HTTP auth rejects forged identity/host/origin, rate limits, and keeps return paths same-origin',async()=>{
 const {db}=await database();await createAccount(db,'seller','another-good-test-password');const handle=authenticationHandler(db,'https://veil.example');
 const server=createServer((req,res)=>handle(req,res,(r,s)=>{s.writeHead(200);s.end(JSON.stringify({identity:r.headers['oai-authenticated-user-id']??null}));}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port,headers={Host:'veil.example',Origin:'https://veil.example','Content-Type':'application/x-www-form-urlencoded'};
 try{const forged=await fetch(url,{headers:{Host:'veil.example','oai-authenticated-user-id':'forged'}});assert.equal((await forged.json()).identity,null);assert.equal((await fetch(url)).status,400);
 assert.equal((await fetch(url+'/signin-with-chatgpt',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'username=seller&password=whatever'})).status,403);
 const login=await fetch(url+'/signin-with-chatgpt',{method:'POST',headers,body:new URLSearchParams({username:'seller',password:'another-good-test-password',return_to:'//evil.example'}),redirect:'manual'});assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/');const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(sessionUser(db,cookie));
 const logout=await fetch(url+'/signout-with-chatgpt',{method:'POST',headers:{...headers,Cookie:cookie},body:'',redirect:'manual'});assert.equal(logout.status,303);assert.equal(sessionUser(db,cookie),null);
 for(let i=0;i<5;i++)assert.equal((await fetch(url+'/signin-with-chatgpt',{method:'POST',headers,body:'username=no-such-user&password=bad'})).status,401);
 assert.equal((await fetch(url+'/signin-with-chatgpt',{method:'POST',headers,body:'username=no-such-user&password=bad'})).status,429);
 for(const value of ['//evil.example','https://evil.example','/\\evil.example','/signin-with-chatgpt','/\r\nHeader: x'])assert.equal(safeReturn(value),'/');
 }finally{await new Promise(r=>server.close(r));db.close();}
});
