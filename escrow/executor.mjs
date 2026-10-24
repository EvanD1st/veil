// Deliberately no wallet RPC, credential reader or live broadcast implementation.
// A separately reviewed PCZT adapter and isolated trial are required before changing this boundary.
export function liveExecutor(){return {enabled:false,async tick(){throw Error('Experimental escrow spending is disabled: validated PCZT input isolation and recovery adapter required.');}};}
export function initializeJournal(db){db.exec(`CREATE TABLE IF NOT EXISTS settlement_journal(id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,destination TEXT NOT NULL,principal TEXT NOT NULL,max_fee TEXT NOT NULL,output_key TEXT NOT NULL UNIQUE,state TEXT NOT NULL,prepared_identity TEXT,prepared_bytes TEXT,txid TEXT,updated_at INTEGER NOT NULL);`);}
// Synthetic-only state machine: exercises crash boundaries without making a wallet call.
export class SyntheticSettlementEngine{
 constructor({db,adapter,now=Date.now,killSwitch=()=>true}){if(adapter?.synthetic!==true)throw Error('Only explicitly synthetic adapters are accepted.');this.db=db;this.adapter=adapter;this.now=now;this.killSwitch=killSwitch;initializeJournal(db);}
 ingest(intent){
  if(intent.network!=='testnet'||!['release','refund'].includes(intent.kind)||!intent.authorized||!intent.destinationFrozen||!intent.destinationValid||!/^testnet:[a-f0-9]{64}:sapling:\d+$/.test(intent.outputKey))throw Error('Invalid authorization, network, destination or exact input binding.');
  for(const key of ['principal','maxFee'])if(!/^[1-9][0-9]*$/.test(intent[key])||BigInt(intent[key])>100000000000000n)throw Error('Integer accounting required.');
  if(BigInt(intent.maxFee)>=BigInt(intent.principal)||BigInt(intent.maxFee)>10000n)throw Error('Excess fee.');
  const existing=this.db.prepare('SELECT * FROM settlement_journal WHERE id=?').get(intent.id);
  if(existing){if(existing.destination!==intent.destination||existing.output_key!==intent.outputKey||existing.principal!==intent.principal||existing.kind!==intent.kind)throw Error('Frozen settlement changed.');return;}
  this.db.prepare('INSERT INTO settlement_journal(id,order_id,kind,destination,principal,max_fee,output_key,state,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(intent.id,intent.orderId,intent.kind,intent.destination,intent.principal,intent.maxFee,intent.outputKey,'requested',this.now());
 }
 async tick(id){
  const row=this.db.prepare('SELECT * FROM settlement_journal WHERE id=?').get(id);if(!row)throw Error('Unknown intent.');
  // A prior crash during preparation cannot be retried without reconciliation.
  if(['preparing','broadcast-unknown','submitted','confirmed'].includes(row.state))return this.reconcile(row);
  if(['frozen'].includes(row.state))return row.state;
  if(this.killSwitch())return 'stopped';
  const check=await this.adapter.readiness(row);
  if(check.network!=='testnet'||check.ready!==true||!Number.isSafeInteger(check.observedAt)||check.observedAt>this.now()||this.now()-check.observedAt>60000||!check.ledgerHealthy||!check.depositConfirmed||check.outputKey!==row.output_key||BigInt(check.spendable)<BigInt(row.principal))return 'unavailable';
  if(row.state==='requested'){
   if(!this.db.prepare("UPDATE settlement_journal SET state='preparing',updated_at=? WHERE id=? AND state='requested'").run(this.now(),id).changes)return 'busy';
   let p;try{p=await this.adapter.prepare(row);}catch{return this.freeze(id);}
   if(!p||!p.identity||!p.bytes||p.destination!==row.destination||p.inputKeys.length!==1||p.inputKeys[0]!==row.output_key||!/^\d+$/.test(p.fee)||BigInt(p.fee)>BigInt(row.max_fee)||BigInt(p.amount)+BigInt(p.fee)+BigInt(p.change)!==BigInt(row.principal)||BigInt(p.amount)<=0n||BigInt(p.change)!==0n)return this.freeze(id);
   this.db.prepare("UPDATE settlement_journal SET state='prepared',prepared_identity=?,prepared_bytes=?,updated_at=? WHERE id=? AND state='preparing'").run(p.identity,p.bytes,this.now(),id);return 'prepared';
  }
  if(row.state==='prepared'){
   if(!this.db.prepare("UPDATE settlement_journal SET state='broadcast-unknown',updated_at=? WHERE id=? AND state='prepared'").run(this.now(),id).changes)return 'busy';
   try{const tx=await this.adapter.broadcast(row);if(tx!==row.prepared_identity)return this.freeze(id);this.db.prepare("UPDATE settlement_journal SET state='submitted',txid=?,updated_at=? WHERE id=?").run(tx,this.now(),id);return 'submitted';}catch{return 'broadcast-unknown';}
  }
  return row.state;
 }
 freeze(id){this.db.prepare("UPDATE settlement_journal SET state='frozen',updated_at=? WHERE id=?").run(this.now(),id);return 'frozen';}
 async reconcile(row){
  // Never prepare or broadcast here. A healthy lookup can confirm a persisted identity;
  // unknown/missing transactions remain frozen, not retried.
  if(!row.prepared_identity)return this.freeze(row.id);
  const check=await this.adapter.readiness(row);if(check.network!=='testnet'||check.ready!==true||!check.ledgerHealthy||check.observedAt>this.now()||this.now()-check.observedAt>60000)return this.freeze(row.id);
  const observation=await this.adapter.lookup(row.prepared_identity);
  if(observation?.network==='testnet'&&observation.active===true&&observation.confirmations>=3&&observation.txid===row.prepared_identity){this.db.prepare("UPDATE settlement_journal SET state='confirmed',txid=?,updated_at=? WHERE id=?").run(observation.txid,this.now(),row.id);return 'confirmed';}
  if(observation?.active===true)return 'submitted';return this.freeze(row.id);
 }
}