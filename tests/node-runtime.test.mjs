import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat} from 'node:fs/promises';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{createServer}from'node:http';
import{initializeDatabase,openDatabase,d1Adapter}from'../runtime/database.mjs';
import{createAccount,authenticate,sessionUser,sessionCookie,revokeSession,COOKIE,safeReturn}from'../runtime/accounts.mjs';
import{authenticationHandler}from'../runtime/http-auth.mjs';
import{loopbackFetch as fetch}from'./loopback-http.mjs';
import{reviewMigrations,migrateOffline}from'../runtime/migrations.mjs';
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
 assert.throws(()=>authenticationHandler(db,'http://public.example',{allowLoopbackHttp:true}));
 assert.throws(()=>authenticationHandler(db,'http://127.0.0.1:8092'));
 const server=createServer((req,res)=>handle(req,res,(r,s)=>{s.writeHead(200);s.end(JSON.stringify({identity:r.headers['oai-authenticated-user-id']??null}));}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port,headers={Host:'veil.example',Origin:'https://veil.example','Content-Type':'application/x-www-form-urlencoded'};
 try{const forged=await fetch(url+'/api/probe',{headers:{Host:'veil.example','oai-authenticated-user-id':'forged'}});assert.equal((await forged.json()).identity,null);assert.equal((await fetch(url)).status,400);
 assert.equal((await fetch(url+'/signin-with-chatgpt',{headers:{Host:'veil.example'}})).headers.get('referrer-policy'),'same-origin');
 assert.equal((await fetch(url+'/signin-with-chatgpt',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'username=seller&password=whatever'})).status,403);
 const login=await fetch(url+'/signin-with-chatgpt',{method:'POST',headers,body:new URLSearchParams({username:'seller',password:'another-good-test-password',return_to:'//evil.example'}),redirect:'manual'});assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/');const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(sessionUser(db,cookie));
 const logout=await fetch(url+'/signout-with-chatgpt',{method:'POST',headers:{...headers,Cookie:cookie},body:'',redirect:'manual'});assert.equal(logout.status,303);assert.equal(sessionUser(db,cookie),null);
 for(let i=0;i<5;i++)assert.equal((await fetch(url+'/signin-with-chatgpt',{method:'POST',headers,body:'username=no-such-user&password=bad'})).status,401);
 assert.equal((await fetch(url+'/signin-with-chatgpt',{method:'POST',headers,body:'username=no-such-user&password=bad'})).status,429);
 for(const value of ['//evil.example','https://evil.example','/\\evil.example','/signin-with-chatgpt','/\r\nHeader: x'])assert.equal(safeReturn(value),'/');
 }finally{await new Promise(r=>server.close(r));db.close();}
});
test('explicit migration reviews hashes, preserves existing data and saves a consistent rollback copy',async()=>{
 const {db,path}=await database();
 db.exec("DROP TABLE scanner_service_health; DROP TABLE payment_scan_jobs; DELETE FROM veil_migrations WHERE name='0004_payment_scan_queue.sql'; CREATE TABLE migration_sentinel(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO migration_sentinel VALUES(1,'preserved old state');");
 assert.deepEqual(reviewMigrations(db,resolve('drizzle')).map(m=>m.name),['0004_payment_scan_queue.sql']);db.close();
 const backup=path+'.before';assert.deepEqual(await migrateOffline(path,resolve('drizzle'),backup),['0004_payment_scan_queue.sql']);
 const current=openDatabase(path),old=openDatabase(backup);
 try{
  assert.equal(current.prepare('SELECT value FROM migration_sentinel').get().value,'preserved old state');
  assert.equal(old.prepare('SELECT value FROM migration_sentinel').get().value,'preserved old state');
  assert.equal(old.prepare('SELECT COUNT(*) n FROM veil_migrations').get().n,4);assert.equal(current.prepare('SELECT COUNT(*) n FROM veil_migrations').get().n,5);
  current.prepare("UPDATE veil_migrations SET sha256='tampered' WHERE name='0004_payment_scan_queue.sql'").run();assert.throws(()=>reviewMigrations(current,resolve('drizzle')),/hash/);
 }finally{current.close();old.close();}
});
