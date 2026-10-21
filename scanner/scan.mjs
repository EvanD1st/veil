// Read-only Zallet + Zebra bridge. No wallet keys or RPC credentials leave this machine.
import { readFile, writeFile } from 'node:fs/promises';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export function reportMessage(r){return Buffer.from(JSON.stringify(['VEIL-PAYMENT-REPORT-v1',r.version,r.invoiceId,r.network,r.txid,r.output,r.pool,r.address,r.amount,r.memo,r.status,r.blockHash,r.blockHeight,r.tipHeight,r.confirmations,r.observedAt,r.expiresAt]));}
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
function synced(wallet,chain){if(wallet.locked!==false||wallet.sync_work_remaining!=null||!wallet.wallet_tip||!Number.isSafeInteger(wallet.fully_synced_height)||wallet.fully_synced_height!==chain.blocks||wallet.wallet_tip.height!==chain.blocks||wallet.wallet_tip.blockhash!==chain.bestblockhash||wallet.node_tip?.blockhash!==chain.bestblockhash)throw Error('Wallet is not fully synchronized with the active node tip.');}
export async function scanInvoice(invoice,txid,output,walletRpc,chainRpc,now=Date.now()){
 if(invoice.version!==1||invoice.network!=='testnet'||!hash(invoice.invoiceId)||!hash(txid)||!Number.isSafeInteger(output)||output<0||output>65535||typeof invoice.address!=='string'||!invoice.address.startsWith('ztestsapling1')||!/^[1-9][0-9]{0,14}$/.test(invoice.amount)||BigInt(invoice.amount)>100000000000000n||invoice.memo!==`VEIL:${invoice.auctionId}:${invoice.bidId}`)throw Error('Invalid testnet invoice or output selector.');
 const chain=await chainRpc('getblockchaininfo',[]);
 if(chain.chain!=='test'||!Number.isSafeInteger(chain.blocks)||!hash(chain.bestblockhash))throw Error('Scanner requires Zebra testnet.');
 synced(await walletRpc('getwalletstatus',[]),chain);
 const tx=await walletRpc('z_viewtransaction',[txid]);
 if(tx.txid!==txid)throw Error('Wallet returned another transaction.');
 const note=tx.outputs?.find(o=>o.pool==='sapling'&&o.output===output);
 const memo=Buffer.from(invoice.memo).toString('hex').padEnd(1024,'0');
 if(!note||note.outgoing!==false||note.walletInternal!==false||note.address!==invoice.address||!Number.isSafeInteger(note.valueZat)||String(note.valueZat)!==invoice.amount||typeof note.memo!=='string'||note.memo.toLowerCase()!==memo)throw Error('Output does not match the exact incoming address, amount and memo.');
 let blockHash=null,blockHeight=null,confirmations=0,status='not-confirmed';
 if(tx.status==='mined'&&hash(tx.blockhash)){
  const block=await chainRpc('getblock',[tx.blockhash,1]);
  if(Number.isSafeInteger(block.height)&&block.height>=0&&block.height<=chain.blocks&&Array.isArray(block.tx)&&block.tx.includes(txid)&&await chainRpc('getblockhash',[block.height])===tx.blockhash){
   const count=chain.blocks-block.height+1;
   if(count>=3&&tx.confirmations===count){status='confirmed';blockHash=tx.blockhash;blockHeight=block.height;confirmations=count;}
  }
 }
 const finalChain=await chainRpc('getblockchaininfo',[]);
 if(finalChain.bestblockhash!==chain.bestblockhash)throw Error('Chain changed during scan. Retry.');
 synced(await walletRpc('getwalletstatus',[]),finalChain);
 return {version:1,invoiceId:invoice.invoiceId,network:'testnet',txid,output,pool:'sapling',address:invoice.address,amount:invoice.amount,memo:invoice.memo,status,blockHash,blockHeight,tipHeight:chain.blocks,confirmations,observedAt:now,expiresAt:now+300000};
}
function rpc(url,auth){const u=new URL(url);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.protocol!=='http:')throw Error('RPC must use a local loopback HTTP endpoint.');return async(method,params)=>{const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Basic '+Buffer.from(auth).toString('base64')}:{})},body:JSON.stringify({jsonrpc:'2.0',id:'veil',method,params}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`RPC HTTP ${r.status}`);const data=await r.json();if(data.error)throw Error(`RPC ${method} failed (${data.error.code}).`);return data.result;};}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(command==='keygen'){
  if(args.length!==1)throw Error('Usage: node scanner/scan.mjs keygen /private/path/scanner.pem');
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');await writeFile(args[0],privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600,flag:'wx'});
  console.log('VEIL_SCANNER_PUBLIC_KEY='+publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex'));return;
 }
 if(command!=='scan'||args.length!==4)throw Error('Usage: node scanner/scan.mjs scan invoice.json TXID SAPLING_OUTPUT report.json');
 const [file,txid,output,destination]=args,invoice=JSON.parse(await readFile(file,'utf8'));
 if(!process.env.VEIL_SCANNER_KEY_FILE||!process.env.ZALLET_RPC_URL||!process.env.ZEBRA_RPC_URL)throw Error('Configure VEIL_SCANNER_KEY_FILE, ZALLET_RPC_URL and ZEBRA_RPC_URL locally.');
 const auth=process.env.ZALLET_COOKIE_FILE?(await readFile(process.env.ZALLET_COOKIE_FILE,'utf8')).trim():process.env.ZALLET_RPC_AUTH;
 const report=await scanInvoice(invoice,txid,Number(output),rpc(process.env.ZALLET_RPC_URL,auth),rpc(process.env.ZEBRA_RPC_URL,process.env.ZEBRA_RPC_AUTH));
 const key=createPrivateKey(await readFile(process.env.VEIL_SCANNER_KEY_FILE));if(key.asymmetricKeyType!=='ed25519')throw Error('Scanner key must be Ed25519.');
 await writeFile(destination,JSON.stringify({report,signature:sign(null,reportMessage(report),key).toString('hex')},null,2),{mode:0o600});console.log(`Saved ${report.status} report, valid for five minutes.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
