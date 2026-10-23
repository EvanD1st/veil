import {spawnSync} from 'node:child_process';
const e2e=process.argv.includes('--e2e');
const args=['./node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','wrangler.local.json','--persist-to',e2e?'.sites-runtime/e2e/state':'.wrangler/state'];
const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
if(result.error)throw result.error;process.exit(result.status??1);
