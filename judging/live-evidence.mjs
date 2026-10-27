// Private evidence builder. Synthetic adapters cannot issue a live capability.
import {createPublicKey,verify,createHash} from 'node:crypto';
import {isSaplingTestnet} from '../scanner/invoice.mjs';
export async function validateManagedEvidence({adapter,db,transferId,signed,scannerPublicKey,fundedRestore,now=Date.now()}){
 if(adapter.evidence!=='live-zingolib-testnet')throw Error('Actual pinned wallet evidence is required.');
 await adapter.readiness();
 const row=db.prepare('SELECT * FROM judge_transfers WHERE id=?').get(transferId),r=signed?.report;
 if(!row||row.kind!=='purchase'||row.state!=='confirmed'||row.broadcast_attempts!==1||row.selector_ack!==1||!r||!/^[a-f0-9]{64}$/.test(scannerPublicKey)||!/^[a-f0-9]{128}$/.test(signed.signature??''))throw Error('Completed exact purchase and selector evidence required.');
 if(r.version!==1||r.network!=='testnet'||r.pool!=='sapling'||r.status!=='confirmed'||r.invoiceId!==row.invoice_id||r.txid!==row.txid||r.output!==row.sapling_output||r.address!==row.destination||r.amount!==row.amount||r.memo!==row.memo)throw Error('Incoming output does not match the retained purchase.');
 if(![r.observedAt,r.expiresAt,r.blockHeight,r.tipHeight,r.confirmations].every(Number.isSafeInteger)||r.observedAt>now+30000||r.observedAt<now-300000||r.expiresAt<=now||r.expiresAt-r.observedAt!==300000||r.confirmations<3||r.confirmations!==r.tipHeight-r.blockHeight+1||!/^[a-f0-9]{64}$/.test(r.blockHash))throw Error('Fresh active-chain evidence required.');
 const message=Buffer.from(JSON.stringify(['VEIL-PAYMENT-REPORT-v1',r.version,r.invoiceId,r.network,r.txid,r.output,r.pool,r.address,r.amount,r.memo,r.status,r.blockHash,r.blockHeight,r.tipHeight,r.confirmations,r.observedAt,r.expiresAt]));
 if(!verify(null,message,createPublicKey({key:Buffer.from('302a300506032b6570032100'+scannerPublicKey,'hex'),format:'der',type:'spki'}),Buffer.from(signed.signature,'hex')))throw Error('Untrusted scanner evidence.');
 const active=await adapter.lookup(row.txid);
 if(await adapter.rpc('getblockhash',[r.blockHeight])!==r.blockHash||!active||active.network!=='testnet'||active.activeChain!==true||active.confirmations<3)throw Error('Active-chain inclusion changed.');
 const inspected=await adapter.inspect(row);if(inspected.rawHex!==row.raw_hex||inspected.txid!==row.txid||inspected.independentlyDecoded!==true)throw Error('Retained bytes did not independently inspect.');
 if(!fundedRestore||fundedRestore.exitCode!==0||fundedRestore.fundsMoved!==false||fundedRestore.aborted!==false||fundedRestore.sourceWalletPreserved!==true||fundedRestore.account!==adapter.config.policy.treasuryAccount||fundedRestore.result?.network!=='testnet'||fundedRestore.result?.independentRecovery!==true||fundedRestore.result?.synchronized!==true||!isSaplingTestnet(fundedRestore.result?.address)||!/^(0|[1-9][0-9]{0,13})$/.test(fundedRestore.result?.confirmed??'')||BigInt(fundedRestore.result.confirmed)<=0n)throw Error('Exact independently funded treasury restoration required.');
 if(db.prepare('SELECT COUNT(*) n FROM managed_service_sessions').get().n<2)throw Error('Service restart and reconciliation evidence required.');
 return {version:1,network:'testnet',binarySha256:adapter.config.binarySha256,fundedRestore:true,preparedInspection:true,singleBroadcast:true,scannerConfirmed:true,restartReconciled:true,validatedAt:now,privateReceiptSha256:createHash('sha256').update(JSON.stringify(signed)).digest('hex')};
}
