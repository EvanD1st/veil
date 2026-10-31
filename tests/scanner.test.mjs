import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { scanInvoice, checkReadiness, preflight, reportMessage } from '../backend/scanner/scan.mjs';
import { rpc, configuredClients, readSigningKey } from '../backend/scanner/rpc.mjs';
import { validateInvoice, paymentRequest, sendingRecipients, decimalZec } from '../backend/scanner/invoice.mjs';
// Synthetic source-derived response shapes, NOT recordings from a wallet or node.
const receiver=JSON.parse(await readFile(new URL('./fixtures/synthetic-receiver.json',import.meta.url))).address;
const now=1792742400000,txid='bb'.repeat(32),block='cc'.repeat(32),tip='dd'.repeat(32);
const auctionId='11111111-1111-4111-8111-111111111111',bidId='22222222-2222-4222-8222-222222222222';
const invoice={version:1,network:'testnet',invoiceId:'aa'.repeat(32),auctionId,bidId,address:receiver,amount:'250',memo:`VEIL:${auctionId}:${bidId}`};
function fixture(){
 const chain={chain:'test',blocks:100,headers:100,bestblockhash:tip,estimatedheight:100,verificationprogress:1};
 const wallet={node_tip:{height:100,blockhash:tip},wallet_tip:{height:100,blockhash:tip},fully_synced_height:100,locked:false};
 const header={hash:tip,height:100,confirmations:1,time:now/1000};
 const tx={txid,status:'mined',confirmations:3,blockhash:block,outputs:[{pool:'sapling',output:7,outgoing:false,walletInternal:false,address:receiver,valueZat:250,memo:Buffer.from(invoice.memo).toString('hex').padEnd(1024,'0')}]};
 const mined={hash:block,height:98,confirmations:3,tx:[txid]};
 const f={chain,wallet,header,tx,mined,active:block,reads:[],finalChain:null};let n=0;
 f.walletRpc=async(method,params)=>{f.reads.push([method,params]);return method==='getwalletstatus'?f.wallet:method==='rpc.discover'?{openrpc:'1.3.2',methods:[{name:'getwalletstatus'},{name:'z_viewtransaction'}]}:f.tx;};
 f.chainRpc=async(method,params)=>{f.reads.push([method,params]);return method==='getblockchaininfo'?(++n>1&&f.finalChain?f.finalChain:f.chain):method==='getblockheader'?f.header:method==='getblock'?f.mined:f.active;};
 f.scan=()=>scanInvoice(invoice,txid,7,f.walletRpc,f.chainRpc,now);return f;
}
test('source-derived Zallet/Zebra shapes accept an exact Sapling index; optional presentation fields omitted',async()=>{
 const f=fixture(),r=await f.scan();assert.equal(r.status,'confirmed');assert.equal(r.output,7);assert.equal(r.confirmations,3);assert.equal(r.expiresAt-r.observedAt,300000);
 assert.ok(f.reads.some(([m,p])=>m==='getblock'&&p[1]===1));
 assert.equal(JSON.parse(reportMessage(r))[0],'VEIL-PAYMENT-REPORT-v1');
});
test('preflight only uses read methods and does not inspect or sign a payment',async()=>{
 const f=fixture();await preflight(f.walletRpc,f.chainRpc,now);
 assert.deepEqual(f.reads.map(x=>x[0]),['rpc.discover','getblockchaininfo','getblockheader','getwalletstatus']);
 await assert.rejects(preflight(async()=>({openrpc:'1',methods:[]}),f.chainRpc,now),/Unsupported/);
});
test('node readiness rejects wrong network, malformed fields, historical synced tips and a bad clock',async()=>{
 for(const change of [{chain:'main'},{chain:'regtest'},{blocks:'100'},{blocks:Number.MAX_SAFE_INTEGER+1},{headers:99},{estimatedheight:104},{verificationprogress:0.5},{verificationprogress:undefined},{verificationprogress:NaN}]){
  const f=fixture();Object.assign(f.chain,change);await assert.rejects(f.scan());
 }
 for(const change of [{time:now/1000-1201},{time:now/1000+121},{time:'1'},{hash:block},{confirmations:0},{height:99}]){
  const f=fixture();Object.assign(f.header,change);await assert.rejects(f.scan());
 }
});
test('wallet optional sync fields are absent only when complete; partial or divergent state fails closed',async()=>{
 for(const change of [{locked:true},{locked:undefined},{fully_synced_height:undefined},{fully_synced_height:99},{sync_work_remaining:{unscanned_blocks:0}},{wallet_tip:undefined},{node_tip:{height:99,blockhash:tip}},{wallet_tip:{height:100,blockhash:block}}]){
  const f=fixture();Object.assign(f.wallet,change);await assert.rejects(f.scan());
 }
});
test('exact incoming note required; decimal value or memoStr never substitutes for integer valueZat or full memo',async()=>{
 for(const change of [{valueZat:'250'},{valueZat:249},{valueZat:250.5},{valueZat:9007199254740992},{valueZat:undefined,value:0.0000025},{outgoing:null},{outgoing:true},{walletInternal:true},{walletInternal:undefined},{address:undefined},{pool:'orchard'},{output:0},{memo:Buffer.from(invoice.memo).toString('hex')},{memo:'00'.repeat(512),memoStr:invoice.memo},{memo:'zz'.repeat(512)}]){
  const f=fixture();Object.assign(f.tx.outputs[0],change);await assert.rejects(f.scan(),/Output/);
 }
 const f=fixture();f.tx.outputs.push({...f.tx.outputs[0]});await assert.rejects(f.scan(),/Output/);
});
test('known unmined statuses and negative confirmations yield a non-confirmation; unknown schemas throw',async()=>{
 for(const status of ['waiting','expiringsoon','expired']){const f=fixture();Object.assign(f.tx,{status,confirmations:-1});delete f.tx.blockhash;assert.equal((await f.scan()).status,'not-confirmed');}
 for(const change of [{status:'confirmed'},{confirmations:'3'},{confirmations:1.5},{txid:block},{outputs:null},{blockhash:undefined}]){const f=fixture();Object.assign(f.tx,change);await assert.rejects(f.scan());}
});
test('active chain, inclusion, node and wallet confirmation counts must agree; races never confirm',async()=>{
 for(const change of [{confirmations:-1},{confirmations:2},{height:99},{height:101},{tx:[]}]){const f=fixture();Object.assign(f.mined,change);assert.equal((await f.scan()).status,'not-confirmed');}
 for(const change of [{hash:tip},{height:'98'},{tx:[{txid}]},{confirmations:'3'}]){const f=fixture();Object.assign(f.mined,change);await assert.rejects(f.scan(),/schema/);}
 const f=fixture();f.active=tip;assert.equal((await f.scan()).status,'not-confirmed');
 const g=fixture();g.tx.confirmations=2;assert.equal((await g.scan()).status,'not-confirmed');
 const h=fixture();h.finalChain={...h.chain,blocks:101,headers:101,estimatedheight:101,bestblockhash:block};await assert.rejects(h.scan());
});
test('invoice boundary rejects invalid checksum, scope, amount, IDs, memo and additional fields',()=>{
 assert.equal(validateInvoice(invoice),invoice);
 for(const change of [{address:receiver.slice(0,-1)+'p'},{address:'ztestsapling1fixture'},{address:'utest1example'},{network:'mainnet'},{amount:250},{amount:'0250'},{amount:'0'},{amount:'1e2'},{amount:'100000000000001'},{invoiceId:[invoice.invoiceId]},{auctionId:[auctionId]},{bidId:[bidId]},{auctionId:'undefined'},{bidId:'x'},{memo:'other'},{extra:true}])assert.throws(()=>validateInvoice({...invoice,...change}));
});
test('ZIP 321 and Zallet preparation preserve one zatoshi, exact upper bound and unpadded base64url memo',()=>{
 for(const amount of ['1','250','100000001','100000000000000']){
  const i={...invoice,amount},uri=paymentRequest(i),q=new URLSearchParams(uri.split('?')[1]);
  assert.equal(q.get('amount'),decimalZec(amount));assert.match(q.get('memo'),/^[A-Za-z0-9_-]+$/);assert.equal(Buffer.from(q.get('memo'),'base64url').toString(),i.memo);
  const recipients=sendingRecipients(i);assert.ok(recipients.includes('"amount":'+decimalZec(amount)));
  const parsed=JSON.parse(recipients);assert.equal(parsed.length,1);assert.equal(parsed[0].address,i.address);assert.equal(Buffer.from(parsed[0].memo,'hex').toString(),i.memo);
 }
});
test('RPC client restricts endpoints, methods and redirects and redacts sensitive failures',async()=>{
 for(const url of ['http://localhost:1','https://127.0.0.1','http://0.0.0.0','http://example.com','http://user:secret@127.0.0.1','http://127.0.0.1/path','http://127.0.0.1?key=secret'])assert.throws(()=>rpc(url,'u:p'));
 let calls=0;const client=rpc('http://127.0.0.1:1','u:p','Wallet',async(_,init)=>{calls++;assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Basic dTpw');return Response.json({jsonrpc:'2.0',id:'veil',result:{locked:false}});});
 assert.deepEqual(await client('getwalletstatus',[]),{locked:false});await assert.rejects(client('z_sendmany',[]),/read methods/);assert.equal(calls,1);
 for(const fetcher of [async()=>{throw Error('secret txid memo cookie');},async()=>Response.json({id:'veil',error:{code:-1,message:'secret txid memo cookie'}}),async()=>Response.json({id:5,result:1}),async()=>new Response('secret',{status:401})]){
  await assert.rejects(rpc('http://127.0.0.1:1','u:p','Wallet',fetcher)('getwalletstatus',[]),e=>!/secret|txid|memo|cookie/.test(e.message));
 }
});
test('configuration, signing keys and CLI diagnostics are read-only and do not expose paths or secrets',async()=>{
 await assert.rejects(configuredClients({}),/Missing ZALLET_RPC_URL/);
 const dir=await mkdtemp(join(tmpdir(),'veil-scanner-')),keyPath=join(dir,'key.pem'),cookie=join(dir,'cookie');
 await writeFile(cookie,'__cookie__:first',{mode:0o600});
 const {privateKey}=generateKeyPairSync('ed25519');await writeFile(keyPath,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
 await readSigningKey({VEIL_SCANNER_KEY_FILE:keyPath});
 const env={...process.env,ZALLET_RPC_URL:'http://127.0.0.1:1',ZEBRA_RPC_URL:'http://127.0.0.1:2',ZALLET_COOKIE_FILE:cookie,ZEBRA_COOKIE_FILE:cookie,VEIL_SCANNER_KEY_FILE:keyPath};
 delete env.ZALLET_RPC_AUTH;delete env.ZEBRA_RPC_AUTH;
 await configuredClients(env);
 const result=spawnSync(process.execPath,['backend/scanner/scan.mjs','preflight'],{env,encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/RPC unavailable/);assert.ok(!result.stderr.includes(dir));assert.ok(!result.stderr.includes('first'));
 const before=await readFile(keyPath,'utf8');const collision=spawnSync(process.execPath,['backend/scanner/scan.mjs','keygen',keyPath],{encoding:'utf8'});assert.equal(collision.status,1);assert.equal(await readFile(keyPath,'utf8'),before);
});

test('config generator creates explicit testnet loopback configs and refuses existing wallet material',async()=>{
 const {initialize,templates}=await import('../backend/scanner/testnet/configure.mjs');
 const dir=await mkdtemp(join(tmpdir(),'veil-lab-'));
 await initialize(dir);
 const nodeConfig=await readFile(join(dir,'zebrad.toml'),'utf8');
 assert.match(nodeConfig,/network = "Testnet"/);assert.match(nodeConfig,/indexer_listen_addr = "127.0.0.1:18230"/);assert.match(nodeConfig,/enable_cookie_auth = true/);
 for(const [role,port] of [['receiver',28232],['sender',28233]]){const cfg=await readFile(join(dir,role,'zallet.toml'),'utf8');assert.match(cfg,/network = "test"/);assert.ok(cfg.includes(`127.0.0.1:${port}`));assert.match(cfg,/require_backup = true/);assert.match(cfg,/allow_insecure_remote_bind = false/);assert.match(cfg,/validator_cookie_path/);assert.match(cfg,/\[sync\]\s+recover_batch_size = 100\s*$/);assert.doesNotMatch(cfg,/lock_threshold|debug_force_finished_sync/);}
 assert.match(templates(dir)['service.env'],/VEIL_SCANNER_RECEIVERS_FILE=.*scanner-receivers\.json/);
 await assert.rejects(initialize(dir));assert.equal(await readFile(join(dir,'zebrad.toml'),'utf8'),nodeConfig);
 const other=await mkdtemp(join(tmpdir(),'veil-existing-'));const {mkdir}=await import('node:fs/promises');await mkdir(join(other,'receiver'));await writeFile(join(other,'receiver','wallet.db'),'existing');
 await assert.rejects(initialize(other));assert.equal(await readFile(join(other,'receiver','wallet.db'),'utf8'),'existing');
 assert.throws(()=>templates('/'));
});
test('HTTP transport rereads rotating cookies and keeps server errors private',async()=>{
 const {createServer}=await import('node:http');const dir=await mkdtemp(join(tmpdir(),'veil-cookie-'));const cookie=join(dir,'cookie');
 await writeFile(cookie,'__cookie__:one',{mode:0o600});let expected='one';let reject=false;const methods=[];
 const server=createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;const request=JSON.parse(body);methods.push(request.method);assert.equal(req.headers.authorization,'Basic '+Buffer.from('__cookie__:'+expected).toString('base64'));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(reject?{id:request.id,error:{code:-1,message:'PRIVATE WALLET DETAILS'}}:{id:request.id,result:{locked:false}}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const port=server.address().port;const c=await configuredClients({ZALLET_RPC_URL:`http://127.0.0.1:${port}`,ZALLET_COOKIE_FILE:cookie,ZEBRA_RPC_URL:`http://127.0.0.1:${port}`,ZEBRA_COOKIE_FILE:cookie});
 await c.walletRpc('getwalletstatus',[]);expected='two';await writeFile(cookie,'__cookie__:two',{mode:0o600});await c.chainRpc('getblockchaininfo',[]);reject=true;
 await assert.rejects(c.walletRpc('getwalletstatus',[]),e=>!e.message.includes('PRIVATE'));assert.deepEqual(methods,['getwalletstatus','getblockchaininfo','getwalletstatus']);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('deployed asset check hashes all manifest groups and rejects auth HTML, truncation or corruption',async()=>{
 const {checkDeployedAssets}=await import('../scripts/check-deployed-assets.mjs');const {createHash}=await import('node:crypto');
 const bytes=Buffer.from('fixture asset'),part={url:'/zk/fixture',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 const manifest={wasm:[part],zkey:[part],runtime:[part]};let reads=0;
 await checkDeployedAssets('https://example.invalid',manifest,async(_,init)=>{reads++;assert.equal(init.redirect,'error');return new Response(bytes);},()=>{});assert.equal(reads,3);
 for(const response of [()=>new Response('login',{status:403}),()=>new Response('login'),()=>new Response(bytes.subarray(1)),()=>new Response(Buffer.concat([bytes,bytes]))])await assert.rejects(checkDeployedAssets('https://example.invalid',manifest,async()=>response(),()=>{}));
});
