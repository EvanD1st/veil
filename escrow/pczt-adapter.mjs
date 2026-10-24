// Pinned Zallet PCZT adapter. Never imported by the website or the read-only scanner.
// Default-off preparation/broadcast gates; no keys, wallet initialization or automatic retries.
import {scanInvoice,checkReadiness} from '../scanner/scan.mjs';
import {validateInvoice,isSaplingTestnet,decimalZec} from '../scanner/invoice.mjs';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('Escrow PCZT safety check failed; preserve the private journal and review.');};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const amount=n=>{if(!integer(n)||n>100000000000000)fail();return BigInt(n);};
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const pczt=s=>{if(typeof s!=='string'||s.length<4||s.length>16000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))fail();return s;};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function initializePcztJournal(db){db.exec(`
 PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS escrow_pczt_journal(order_id TEXT PRIMARY KEY,account_uuid TEXT NOT NULL UNIQUE,output_key TEXT NOT NULL UNIQUE,intent_hash TEXT NOT NULL,state TEXT NOT NULL,pczt TEXT,inspection_hash TEXT,raw_hex TEXT,txid TEXT,updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS escrow_pczt_audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,state TEXT NOT NULL,recorded_at INTEGER NOT NULL);
 CREATE TRIGGER IF NOT EXISTS pczt_binding_immutable BEFORE UPDATE ON escrow_pczt_journal WHEN NEW.order_id<>OLD.order_id OR NEW.account_uuid<>OLD.account_uuid OR NEW.output_key<>OLD.output_key OR NEW.intent_hash<>OLD.intent_hash BEGIN SELECT RAISE(ABORT,'Immutable PCZT binding');END;
 CREATE TRIGGER IF NOT EXISTS pczt_audit_insert AFTER INSERT ON escrow_pczt_journal BEGIN INSERT INTO escrow_pczt_audit(order_id,state,recorded_at) VALUES(NEW.order_id,NEW.state,NEW.updated_at);END;
 CREATE TRIGGER IF NOT EXISTS pczt_audit_update AFTER UPDATE ON escrow_pczt_journal BEGIN INSERT INTO escrow_pczt_audit(order_id,state,recorded_at) VALUES(NEW.order_id,NEW.state,NEW.updated_at);END;
 CREATE TRIGGER IF NOT EXISTS pczt_journal_no_delete BEFORE DELETE ON escrow_pczt_journal BEGIN SELECT RAISE(ABORT,'Preserve prepared transaction recovery records');END;
 CREATE TRIGGER IF NOT EXISTS pczt_audit_no_update BEFORE UPDATE ON escrow_pczt_audit BEGIN SELECT RAISE(ABORT,'Append-only PCZT audit');END;
 CREATE TRIGGER IF NOT EXISTS pczt_audit_no_delete BEFORE DELETE ON escrow_pczt_audit BEGIN SELECT RAISE(ABORT,'Append-only PCZT audit');END;
 `);}
export function verifyInspection(info,{binding,destination,principal,maxFee,tipHeight,branchId},requireProofs=false){
 if(!info||info.wallet_created!==true||info.privacy_policy!=='FullPrivacy'||!info.signing_hints||info.signing_hints.seed_fingerprint!==binding.seedFingerprint||info.signing_hints.account_index!==binding.accountIndex||!integer(info.tx_version)||!integer(info.expiry_height)||info.expiry_height<=tipHeight+3||info.expiry_height>tipHeight+500||info.consensus_branch_id!==branchId)fail();
 const fee=amount(info.fee_zat);if(fee>BigInt(maxFee))fail();
 if(!info.transparent||!Array.isArray(info.transparent.inputs)||!Array.isArray(info.transparent.outputs)||info.transparent.inputs.length||info.transparent.outputs.length)fail();
 for(const name of ['orchard','ironwood']){const pool=info[name];if(!pool||pool.actions!==0||pool.signed_actions!==0||pool.value_balance_zat!==0||!Array.isArray(pool.outputs)||pool.outputs.length)fail();}
 const sapling=info.sapling;if(!sapling||sapling.spends!==1||!Array.isArray(sapling.outputs)||amount(sapling.value_balance_zat)!==fee||(requireProofs&&sapling.proofs_complete!==true))fail();
 const paying=sapling.outputs.filter(o=>amount(o.value_zat)>0n);if(paying.length!==1||paying[0].user_address!==destination||amount(paying[0].value_zat)+fee!==BigInt(principal))fail();
 // Padding must explicitly carry zero value. Missing/redacted output values fail closed.
 for(const o of sapling.outputs)if(amount(o.value_zat)===0n&&o.user_address!=null&&o.user_address!==destination)fail();
 return {fee:fee.toString(),amount:amount(paying[0].value_zat).toString(),fingerprint:digest({version:info.tx_version,branch:info.consensus_branch_id,expiry:info.expiry_height,hints:info.signing_hints,fee:info.fee_zat,transparent:info.transparent,sapling:{spends:sapling.spends,outputs:sapling.outputs,value_balance_zat:sapling.value_balance_zat},orchard:info.orchard.outputs,ironwood:info.ironwood.outputs})};
}
export class PcztAdapter{
 constructor({db,walletRpc,chainRpc,rawWalletRpc,binding,invoice,selector,authorization,now=Date.now,killSwitch=()=>true,allowPreparation=false,allowBroadcast=false}){
  validateInvoice(invoice);if(!binding||typeof binding.accountUuid!=='string'||!binding.seedFingerprint||!integer(binding.accountIndex)||!authorization||authorization.network!=='testnet'||authorization.orderId!==invoice.auctionId||!['release','refund'].includes(authorization.kind)||!isSaplingTestnet(authorization.destination)||authorization.principal!==invoice.amount||!/^[1-9][0-9]*$/.test(authorization.maxFee)||BigInt(authorization.maxFee)>10000n||BigInt(authorization.maxFee)>=BigInt(invoice.amount)||!hash(selector.txid)||!integer(selector.output)||selector.output>65535)fail();
  Object.assign(this,{db,walletRpc,chainRpc,rawWalletRpc,binding:structuredClone(binding),invoice:structuredClone(invoice),selector:structuredClone(selector),authorization:structuredClone(authorization),now,killSwitch,allowPreparation,allowBroadcast});initializePcztJournal(db);
  this.outputKey=`testnet:${selector.txid}:sapling:${selector.output}`;this.intentHash=digest({authorization:this.authorization,binding:this.binding,invoice:this.invoice,selector:this.selector});
 }
 gate(broadcast=false){if(this.killSwitch()||!(broadcast?this.allowBroadcast:this.allowPreparation))throw Error('Escrow PCZT execution gate is disabled.');}
 row(){return this.db.prepare('SELECT * FROM escrow_pczt_journal WHERE order_id=?').get(this.invoice.auctionId);}
 save(state,values={}){const keys=Object.keys(values);if(keys.some(k=>!['pczt','inspection_hash','raw_hex','txid'].includes(k)))fail();this.db.prepare(`UPDATE escrow_pczt_journal SET state=?,updated_at=?${keys.length?','+keys.map(k=>k+'=?').join(','):''} WHERE order_id=?`).run(state,this.now(),...Object.values(values),this.invoice.auctionId);}
 async isolation(){
  const report=await scanInvoice(this.invoice,this.selector.txid,this.selector.output,this.walletRpc,this.chainRpc,this.now());if(report.status!=='confirmed')fail();
  const account=await this.walletRpc('z_getaccount',[this.binding.accountUuid]);if(account?.account_uuid!==this.binding.accountUuid||account.seedfp!==this.binding.seedFingerprint||account.zip32_account_index!==this.binding.accountIndex)fail();
  // Do not filter by receiver: that could hide internal/change notes or another receiver of the account.
  const notes=await this.walletRpc('z_listunspent',[0,9999999,true,[]]);if(!Array.isArray(notes))fail();const own=notes.filter(n=>n.account_uuid===this.binding.accountUuid);if(own.length!==1)fail();
  const note=own[0],memo=Buffer.from(this.invoice.memo).toString('hex').padEnd(1024,'0');
  if(note.txid!==this.selector.txid||note.outindex!==this.selector.output||note.pool!=='sapling'||note.account_uuid!==this.binding.accountUuid||note.address!==this.invoice.address||note.is_watch_only!==false||note.walletInternal!==false||note.confirmations<3||!integer(note.confirmations)||amount(note.valueZat)!==BigInt(this.invoice.amount)||typeof note.memo!=='string'||note.memo.toLowerCase()!==memo)fail();
  const balance=await this.walletRpc('z_getbalanceforaccount',[this.binding.accountUuid,3]);if(balance?.minimum_confirmations!==3||amount(balance.pools?.sapling?.valueZat)!==BigInt(this.invoice.amount)||Object.keys(balance.pools).some(k=>k!=='sapling'))fail();
  const chain=await this.chainRpc('getblockchaininfo',[]);if(chain.chain!=='test'||!hash(chain.bestblockhash)||!integer(chain.blocks)||typeof chain.consensus?.chaintip!=='string')fail();
  return {tipHeight:chain.blocks,branchId:chain.consensus.chaintip,binding:this.binding,destination:this.authorization.destination,principal:this.invoice.amount,maxFee:this.authorization.maxFee};
 }
 async prepare(){
  this.gate();const previous=this.row();if(previous){if(previous.intent_hash!==this.intentHash)fail();if(previous.state==='prepared')return {state:'prepared',txid:previous.txid};throw Error('Existing PCZT journal requires reconciliation; preparation will not be repeated.');}
  const context=await this.isolation();
  this.db.prepare("INSERT INTO escrow_pczt_journal(order_id,account_uuid,output_key,intent_hash,state,updated_at) VALUES(?,?,?,?,?,?)").run(this.invoice.auctionId,this.binding.accountUuid,this.outputKey,this.intentHash,'creating',this.now());
  try{
   this.gate();const net=(BigInt(this.invoice.amount)-BigInt(this.authorization.maxFee)).toString();
   // Exact numeric ZEC literal: no floating point arithmetic or string-to-number conversion.
   const params='['+JSON.stringify(this.binding.accountUuid)+',[{"address":'+JSON.stringify(this.authorization.destination)+',"amount":'+decimalZec(net)+'}],3,"FullPrivacy","sapling"]';
   const created=await this.rawWalletRpc('pczt_create',params);if(created?.privacy_policy!=='FullPrivacy')fail();const unsigned=pczt(created.pczt);this.save('unsigned',{pczt:unsigned});
   const inspected=await this.walletRpc('pczt_inspect',[unsigned]);const checked=verifyInspection(inspected,context);this.save('reviewed',{inspection_hash:checked.fingerprint});
   // Recheck the sole account note before signing. Any extra/changed deposit freezes this attempt.
   await this.isolation();this.gate();
   const proven=await this.walletRpc('pczt_prove',[unsigned]);const proved=pczt(proven?.pczt);if(verifyInspection(await this.walletRpc('pczt_inspect',[proved]),context,true).fingerprint!==checked.fingerprint)fail();this.save('proved',{pczt:proved});
   this.gate();const signed=await this.walletRpc('pczt_sign',[proved,'FullPrivacy',true]);for(const pool of ['transparent','sapling','orchard','ironwood'])if(!Array.isArray(signed?.['unsigned_'+pool])||signed['unsigned_'+pool].length)fail();if(signed.sapling_signed!==1||signed.transparent_signed!==0||signed.orchard_signed!==0||signed.ironwood_signed!==0)fail();
   const signedBytes=pczt(signed.pczt);if(verifyInspection(await this.walletRpc('pczt_inspect',[signedBytes]),context,true).fingerprint!==checked.fingerprint)fail();
   // Persist signed bytes before extraction, which records pending spends in Zallet.
   this.save('extracting',{pczt:signedBytes});this.gate();const extracted=await this.walletRpc('pczt_extract',[signedBytes]);if(extracted?.stored!==true||!hash(extracted.txid)||typeof extracted.hex!=='string'||extracted.hex.length>4000000||!/^([a-f0-9]{2})+$/.test(extracted.hex))fail();
   const decoded=await this.walletRpc('decoderawtransaction',[extracted.hex]);if(decoded?.txid!==extracted.txid)fail();this.save('prepared',{raw_hex:extracted.hex,txid:extracted.txid});return {state:'prepared',txid:extracted.txid};
  }catch{this.save('frozen');throw Error('PCZT preparation frozen; no broadcast was attempted. Review the private recovery journal.');}
 }
 async broadcast(){
  this.gate(true);const row=this.row();if(!row||row.intent_hash!==this.intentHash||row.state!=='prepared'||!row.raw_hex||!hash(row.txid))throw Error('No reviewed prepared transaction; never resend an uncertain broadcast.');
  const chain=await checkReadiness(this.walletRpc,this.chainRpc,this.now());const inspected=await this.walletRpc('pczt_inspect',[row.pczt]);const context={binding:this.binding,destination:this.authorization.destination,principal:this.invoice.amount,maxFee:this.authorization.maxFee,tipHeight:chain.blocks,branchId:chain.consensus.chaintip};if(verifyInspection(inspected,context,true).fingerprint!==row.inspection_hash)fail();
  // Verify the original incoming output still belongs to the active chain; pending-spent state
  // is expected after extract, so z_listunspent is not used as a false proof of missing funds.
  if((await scanInvoice(this.invoice,this.selector.txid,this.selector.output,this.walletRpc,this.chainRpc,this.now())).status!=='confirmed')fail();
  this.gate(true);const claimed=this.db.prepare("UPDATE escrow_pczt_journal SET state='broadcast-unknown',updated_at=? WHERE order_id=? AND state='prepared'").run(this.now(),row.order_id);if(!claimed.changes)throw Error('Concurrent broadcast attempt refused.');
  try{const txid=await this.chainRpc('sendrawtransaction',[row.raw_hex]);if(txid!==row.txid)throw Error();this.save('submitted');return {state:'submitted',txid:row.txid};}catch{if(row.state==='confirmed')this.save('frozen');return {state:'broadcast-unknown',txid:row.txid};}
 }
 async reconcile(){
  const row=this.row();if(!row||row.intent_hash!==this.intentHash||!hash(row.txid))return {state:'operator-review'};
  // Read-only recovery. No prepare/sign/extract/broadcast call occurs here, even if absent.
  await checkReadiness(this.walletRpc,this.chainRpc,this.now());
  let tx;try{tx=await this.chainRpc('getrawtransaction',[row.txid,1]);}catch{if(row.state==='confirmed')this.save('frozen');return {state:'broadcast-unknown',txid:row.txid};}
  if(tx?.txid!==row.txid){this.save('frozen');return {state:'frozen',txid:row.txid};}
  if(!hash(tx.blockhash)||!integer(tx.confirmations)||tx.confirmations<3){this.save(row.state==='confirmed'?'frozen':'submitted');return {state:'pending',txid:row.txid};}
  const block=await this.chainRpc('getblock',[tx.blockhash,1]),chain=await this.chainRpc('getblockchaininfo',[]);
  if(chain.chain!=='test'||!integer(block?.height)||block.hash!==tx.blockhash||!Array.isArray(block.tx)||!block.tx.includes(row.txid)||await this.chainRpc('getblockhash',[block.height])!==tx.blockhash||chain.blocks-block.height+1!==tx.confirmations){this.save('frozen');return {state:'frozen',txid:row.txid};}
  this.save('confirmed');return {state:'confirmed',txid:row.txid};
 }
}