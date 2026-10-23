// Read-only Zallet + Zebra bridge. No wallet keys or RPC credentials leave this machine.
import { readFile, writeFile } from 'node:fs/promises';
import { generateKeyPairSync, sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateInvoice } from './invoice.mjs';
import { configuredClients, readSigningKey, SafeError } from './rpc.mjs';
export function reportMessage(r){return Buffer.from(JSON.stringify(['VEIL-PAYMENT-REPORT-v1',r.version,r.invoiceId,r.network,r.txid,r.output,r.pool,r.address,r.amount,r.memo,r.status,r.blockHash,r.blockHeight,r.tipHeight,r.confirmations,r.observedAt,r.expiresAt]));}
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const height=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const fail=message=>{throw new SafeError(message);};
function chainShape(chain) {
 if(!chain||chain.chain!=='test')fail('Scanner requires Zebra testnet (network mismatch or unsupported response).');
 if(!height(chain.blocks)||!hash(chain.bestblockhash)||!height(chain.headers)||!height(chain.estimatedheight)||typeof chain.verificationprogress!=='number'||!Number.isFinite(chain.verificationprogress)||chain.verificationprogress<0||chain.verificationprogress>1)fail('Unsupported Zebra getblockchaininfo schema.');
 // These are conservative VEIL readiness limits, not Zcash consensus rules.
 if(chain.blocks===0||chain.headers!==chain.blocks||chain.estimatedheight>chain.blocks+3||chain.verificationprogress<0.999)fail('Zebra is still syncing or its estimated tip is too far ahead.');
}
function synced(wallet,chain){
 if(!wallet||typeof wallet.locked!=='boolean'||!wallet.node_tip||!height(wallet.node_tip.height)||!hash(wallet.node_tip.blockhash))fail('Unsupported Zallet getwalletstatus schema.');
 if(wallet.locked!==false||wallet.sync_work_remaining!=null||!wallet.wallet_tip||!height(wallet.fully_synced_height)||wallet.fully_synced_height!==chain.blocks||wallet.wallet_tip.height!==chain.blocks||wallet.wallet_tip.blockhash!==chain.bestblockhash||wallet.node_tip.height!==chain.blocks||wallet.node_tip.blockhash!==chain.bestblockhash)fail('Wallet is not fully synchronized with the active node tip.');
}
export async function checkReadiness(walletRpc,chainRpc,now=Date.now()) {
 const chain=await chainRpc('getblockchaininfo',[]);chainShape(chain);
 const tip=await chainRpc('getblockheader',[chain.bestblockhash,true]);
 if(!tip||tip.hash!==chain.bestblockhash||tip.height!==chain.blocks||tip.confirmations!==1||!Number.isSafeInteger(tip.time))fail('Unsupported or inconsistent Zebra tip header.');
 if(tip.time*1000<now-1200000||tip.time*1000>now+120000)fail('Node tip is stale or local clock is wrong. Check peers, sync and clock.');
 synced(await walletRpc('getwalletstatus',[]),chain);
 return chain;
}
export async function scanInvoice(invoice,txid,output,walletRpc,chainRpc,now=Date.now()){
 try{validateInvoice(invoice);}catch{fail('Invalid testnet invoice.');}
 if(!hash(txid)||!Number.isSafeInteger(output)||output<0||output>65535||!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(now+300000))fail('Invalid testnet invoice or output selector.');
 const chain=await checkReadiness(walletRpc,chainRpc,now);
 const tx=await walletRpc('z_viewtransaction',[txid]);
 if(!tx||tx.txid!==txid||!['mined','waiting','expiringsoon','expired'].includes(tx.status)||!Number.isSafeInteger(tx.confirmations)||tx.confirmations< -1||!Array.isArray(tx.outputs))fail('Unsupported Zallet z_viewtransaction schema or transaction mismatch.');
 const notes=tx.outputs.filter(o=>o?.pool==='sapling'&&o.output===output);
 const note=notes[0],memo=Buffer.from(invoice.memo,'utf8').toString('hex').padEnd(1024,'0');
 if(notes.length!==1||note.outgoing!==false||note.walletInternal!==false||note.address!==invoice.address||!Number.isSafeInteger(note.valueZat)||String(note.valueZat)!==invoice.amount||typeof note.memo!=='string'||!/^[a-fA-F0-9]{1024}$/.test(note.memo)||note.memo.toLowerCase()!==memo)fail('Output does not match the exact incoming address, amount and memo.');
 let blockHash=null,blockHeight=null,confirmations=0,status='not-confirmed';
 if(tx.status==='mined'){
  if(!hash(tx.blockhash))fail('Mined Zallet transaction has no valid block hash.');
  const block=await chainRpc('getblock',[tx.blockhash,1]);
  if(!block||block.hash!==tx.blockhash||!Number.isSafeInteger(block.confirmations)||!Array.isArray(block.tx)||!block.tx.every(hash)||(block.height!=null&&!height(block.height)))fail('Unsupported Zebra getblock schema.');
  if(height(block.height)&&block.height<=chain.blocks&&block.tx.includes(txid)&&await chainRpc('getblockhash',[block.height])===tx.blockhash){
   const count=chain.blocks-block.height+1;
   if(count>=3&&tx.confirmations===count&&block.confirmations===count){status='confirmed';blockHash=tx.blockhash;blockHeight=block.height;confirmations=count;}
  }
 }else if(tx.blockhash!=null){fail('Unmined Zallet transaction unexpectedly has a block hash.');}
 const finalChain=await checkReadiness(walletRpc,chainRpc,now);
 if(finalChain.bestblockhash!==chain.bestblockhash||finalChain.blocks!==chain.blocks)fail('Chain changed during scan. Retry.');
 return {version:1,invoiceId:invoice.invoiceId,network:'testnet',txid,output,pool:'sapling',address:invoice.address,amount:invoice.amount,memo:invoice.memo,status,blockHash,blockHeight,tipHeight:chain.blocks,confirmations,observedAt:now,expiresAt:now+300000};
}
export async function preflight(walletRpc,chainRpc,now=Date.now()) {
 const discovery=await walletRpc('rpc.discover',[]);
 if(!discovery||typeof discovery.openrpc!=='string'||!Array.isArray(discovery.methods)||!['getwalletstatus','z_viewtransaction'].every(name=>discovery.methods.some(m=>m.name===name)))fail('Unsupported Zallet RPC discovery: required read methods missing.');
 await checkReadiness(walletRpc,chainRpc,now);
}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(command==='keygen'){
  if(args.length!==1)fail('Usage: node scanner/scan.mjs keygen /private/path/scanner.pem');
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  try{await writeFile(args[0],privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600,flag:'wx'});}catch{fail('Cannot create signing key; choose a new path in a private directory. Existing files are never overwritten.');}
  console.log('VEIL_SCANNER_PUBLIC_KEY='+publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex'));return;
 }
 if(command==='preflight'&&(args.length===0||args.length===3)){
  const {walletRpc,chainRpc}=await configuredClients();await readSigningKey();
  await preflight(walletRpc,chainRpc);
  if(args.length){const invoice=JSON.parse(await readFile(args[0],'utf8'));await scanInvoice(invoice,args[1],parseOutput(args[2]),walletRpc,chainRpc);}
  console.log('PASS: testnet RPC readiness, wallet sync and Ed25519 key. No signing or writes performed.');
  console.log(args.length?'Exact output checks completed; no signed payment confirmation was produced.':'Payment output schema is unchecked until a transaction is supplied.');
  console.log('Binary commit provenance and upstream audit acceptance require the operator checklist.');return;
 }
 if(command!=='scan'||args.length!==4)fail('Usage: node scanner/scan.mjs preflight [invoice.json TXID SAPLING_OUTPUT] | scan invoice.json TXID SAPLING_OUTPUT report.json');
 const [file,txid,output,destination]=args,invoice=JSON.parse(await readFile(file,'utf8'));
 const {walletRpc,chainRpc}=await configuredClients();const key=await readSigningKey();
 const report=await scanInvoice(invoice,txid,parseOutput(output),walletRpc,chainRpc);
 try{await writeFile(destination,JSON.stringify({report,signature:sign(null,reportMessage(report),key).toString('hex')},null,2),{mode:0o600,flag:'wx'});}catch{fail('Cannot create report; choose a new private output path. Existing files are never overwritten.');}
 console.log(`Saved ${report.status} report, valid for five minutes.`);
}
function parseOutput(value){if(!/^(0|[1-9][0-9]{0,4})$/.test(value))fail('Output index must be a canonical unsigned decimal integer.');return Number(value);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e instanceof SafeError?e.message:'Scanner failed; check private input files and local configuration. No new report was produced.');process.exitCode=1;});
