// Synthetic evidence fixtures only. This does not call a wallet or send funds.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validateManagedEvidence} from '../judging/live-evidence.mjs';

const address=JSON.parse(readFileSync('tests/fixtures/synthetic-receiver.json','utf8')).address;
function fixture(){
 const now=1_000_000,txid='a'.repeat(64),blockHash='b'.repeat(64),rawHex='abcd',invoiceId='c'.repeat(64),memo='VEIL:123e4567-e89b-12d3-a456-426614174000:123e4567-e89b-12d3-a456-426614174001';
 const {privateKey,publicKey}=generateKeyPairSync('ed25519'),scannerPublicKey=publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');
 const report={version:1,invoiceId,network:'testnet',txid,output:1,pool:'sapling',address,amount:'20000',memo,status:'confirmed',blockHash,blockHeight:9,tipHeight:11,confirmations:3,observedAt:now,expiresAt:now+300000};
 const message=Buffer.from(JSON.stringify(['VEIL-PAYMENT-REPORT-v1',report.version,report.invoiceId,report.network,report.txid,report.output,report.pool,report.address,report.amount,report.memo,report.status,report.blockHash,report.blockHeight,report.tipHeight,report.confirmations,report.observedAt,report.expiresAt]));
 const signed={report,signature:sign(null,message,privateKey).toString('hex')};
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE judge_transfers(id TEXT,kind TEXT,state TEXT,broadcast_attempts INTEGER,selector_ack INTEGER,invoice_id TEXT,txid TEXT,sapling_output INTEGER,destination TEXT,amount TEXT,memo TEXT,raw_hex TEXT); CREATE TABLE managed_service_sessions(id TEXT,opened_at INTEGER);');
 db.prepare('INSERT INTO judge_transfers VALUES(\'transfer\',\'purchase\',\'confirmed\',1,1,?,?,?,?,?,?,?)').run(invoiceId,txid,1,address,'20000',memo,rawHex);
 db.prepare('INSERT INTO managed_service_sessions VALUES(\'one\',1),(\'two\',2)').run();
 const adapter={evidence:'live-zingolib-testnet',config:{binarySha256:'d'.repeat(64),policy:{treasuryAccount:'treasury'}},async readiness(){},async lookup(){return{network:'testnet',txid,activeChain:true,confirmations:3};},async rpc(){return blockHash;},async inspect(){return{rawHex,txid,independentlyDecoded:true};}};
 const fundedRestore={mode:'status',account:'treasury',exitCode:0,fundsMoved:false,aborted:false,sourceWalletPreserved:true,result:{network:'testnet',independentRecovery:true,synchronized:true,address,confirmed:'1000000'}};
 return{now,db,adapter,signed,scannerPublicKey,fundedRestore,txid,report};
}
test('live evidence requires exact funded restore, one broadcast, signed invoice output and durable outbox',async()=>{
 const f=fixture();try{const result=await validateManagedEvidence({...f,transferId:'transfer',now:f.now});assert.equal(result.fundedRestore,true);assert.equal(result.singleBroadcast,true);assert.equal(result.scannerConfirmed,true);assert.equal(result.restartReconciled,true);}
 finally{f.db.close();}
});
test('live evidence refuses missing funded account binding and a repeat send',async()=>{
 const f=fixture();try{await assert.rejects(validateManagedEvidence({...f,transferId:'transfer',fundedRestore:{...f.fundedRestore,account:'other'},now:f.now}),/funded treasury restoration/);f.db.prepare("UPDATE judge_transfers SET broadcast_attempts=0").run();await assert.rejects(validateManagedEvidence({...f,transferId:'transfer',now:f.now}),/completed exact purchase/i);}
 finally{f.db.close();}
});
