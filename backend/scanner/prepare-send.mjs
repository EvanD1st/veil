// Offline preparation only: never contacts a wallet and never submits a transaction.
import { readFile, writeFile } from 'node:fs/promises';
import { sendingRecipients, paymentRequest } from './invoice.mjs';
try {
 const [invoicePath,destination]=process.argv.slice(2);
 if(!invoicePath||!destination||process.argv.length!==4)throw Error();
 const invoice=JSON.parse(await readFile(invoicePath,'utf8'));
 const recipients=sendingRecipients(invoice);
 await writeFile(destination,recipients+'\n',{mode:0o600,flag:'wx'});
 // Keep address, memo and URI in a second private file, never console output.
 await writeFile(destination+'.uri',paymentRequest(invoice)+'\n',{mode:0o600,flag:'wx'});
 console.log('Prepared private recipients JSON and ZIP 321 URI. No RPC call or payment was made.');
} catch { console.error('Preparation failed. Use: node scanner/prepare-send.mjs invoice.json NEW_PRIVATE_RECIPIENTS_PATH; existing files are never overwritten.');process.exitCode=1; }
