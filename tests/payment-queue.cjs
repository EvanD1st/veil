// Synthetic published auction rows; production SQL, permissions and report signatures execute.
module.exports=({test,assert,db,env,server,core,auctionId,realNow})=>{
 test('automatic queue enforces roles, exclusive leases, exact output, signed delivery, expiry and replay recovery',async()=>{
  const {generateKeyPairSync,sign,createHash}=require('node:crypto');
  const queue=require('../.sites-runtime/test-build/lib/veil/payment-queue.js');
  const {reportMessage}=require('../.sites-runtime/test-build/lib/veil/payment.js');
  let now=realNow();Date.now=()=>now;
  const pair=generateKeyPairSync('ed25519'),token='ab'.repeat(32);
  env.VEIL_SCANNER_PUBLIC_KEY=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');
  env.VEIL_SCANNER_SERVICE_TOKEN_SHA256=createHash('sha256').update(token).digest('hex');
  const row={...db.prepare('SELECT * FROM auctions WHERE id=?').get(auctionId),id:crypto.randomUUID(),owner_id:'queue-seller'};
  const winnerId=crypto.randomUUID();row.result=JSON.stringify({...JSON.parse(row.result),winnerId});
  const columns=Object.keys(row);db.prepare('INSERT INTO auctions('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').run(...Object.values(row));
  db.prepare('INSERT INTO bids(id,auction_id,bidder_id,commitment,ciphertext,ciphertext_hash,accepted_at) VALUES(?,?,?,?,?,?,?)').run(winnerId,row.id,'queue-winner','ab'.repeat(32),'synthetic-envelope','cd'.repeat(32),now);
  const selector={txid:'fe'.repeat(32),output:9};
  await assert.rejects(queue.queuePaymentScan(row.id,selector,'outsider'),{status:403});
  await assert.rejects(queue.scannerAuthentication(new Request('https://veil.example/api/scanner/jobs')),{status:401});
  await queue.scannerAuthentication(new Request('https://veil.example/api/scanner/jobs',{headers:{Authorization:'Bearer '+token}}));
  await queue.queuePaymentScan(row.id,selector,'queue-winner');await queue.queuePaymentScan(row.id,selector,'queue-seller');
  await assert.rejects(queue.queuePaymentScan(row.id,{...selector,output:10},'queue-seller'),{status:409});
  const claimed=await queue.scannerExchange({action:'claim'}),job=claimed.job;assert.ok(job);assert.equal((await queue.scannerExchange({action:'claim'})).job,null);
  const report={version:1,invoiceId:job.invoice.invoiceId,network:'testnet',...selector,pool:'sapling',address:job.invoice.address,amount:job.invoice.amount,memo:job.invoice.memo,status:'confirmed',blockHash:'ce'.repeat(32),blockHeight:98,tipHeight:100,confirmations:3,observedAt:now,expiresAt:now+300000};
  const signed=r=>({report:r,signature:sign(null,reportMessage(r),pair.privateKey).toString('hex')});
  await assert.rejects(queue.scannerExchange({action:'report',jobId:job.id,leaseId:'wrong',signed:signed(report)}),{status:409});
  await assert.rejects(queue.scannerExchange({action:'report',jobId:job.id,leaseId:job.leaseId,signed:signed({...report,output:10})}),/queued output/);
  const delivery={action:'report',jobId:job.id,leaseId:job.leaseId,signed:signed(report)};
  await queue.scannerExchange(delivery);await queue.scannerExchange(delivery);assert.equal((await server.paymentStatus(row.id,'queue-winner')).status,'scanner-confirmed');
  now+=300001;assert.equal((await server.paymentStatus(row.id,'queue-winner')).status,'needs-refresh');
  const next=(await queue.scannerExchange({action:'claim'})).job;assert.ok(next);
  const revoked={...report,status:'not-confirmed',blockHash:null,blockHeight:null,confirmations:0,observedAt:now,expiresAt:now+300000};
  await queue.scannerExchange({action:'report',jobId:next.id,leaseId:next.leaseId,signed:signed(revoked)});assert.equal((await server.paymentStatus(row.id,'queue-seller')).status,'not-confirmed');
  now+=60001;const abandoned=(await queue.scannerExchange({action:'claim'})).job;assert.ok(abandoned);now+=600001;assert.ok((await queue.scannerExchange({action:'claim'})).job);
  delete env.VEIL_SCANNER_SERVICE_TOKEN_SHA256;Date.now=realNow;
 });
 test('proof budgets allow slow progress but enforce stalls, phase caps and cancellation cleanup',()=>{
  const {proofDeadline}=require('../.sites-runtime/test-build/lib/veil/zk/deadline.js');
  let now=0,next=0,tasks=new Map(),message;
  const timers={set:(fn,delay)=>{tasks.set(++next,{at:now+delay,fn});return next;},clear:id=>tasks.delete(id)};
  const advance=ms=>{const end=now+ms;while(true){const due=[...tasks].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;tasks.delete(due[0]);due[1].fn();}now=end;};
  let budget=proofDeadline(m=>{message=m;},undefined,timers);
  for(let n=1;n<=20;n++){budget.progress({phase:'download',activity:n});advance(30000);}assert.equal(message,undefined); // Ten minutes of useful download progress is not a hung prover.
  budget.progress({phase:'prove'});advance(599999);assert.equal(message,undefined);advance(1);assert.match(message,/generation timed out/);
  message=undefined;budget=proofDeadline(m=>{message=m;},undefined,timers);budget.progress({phase:'download',activity:1});advance(45000);assert.match(message,/stalled/);
  message=undefined;budget=proofDeadline(m=>{message=m;},undefined,timers);budget.stop();advance(1000000);assert.equal(message,undefined);assert.equal(tasks.size,0);
  budget=proofDeadline(m=>{message=m;},100,timers);advance(100);assert.match(message,/timed out/);
 });
};
