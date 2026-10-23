import {spawnSync} from 'node:child_process';
const initialized=spawnSync(process.execPath,['scripts/db-local.mjs','--e2e'],{stdio:'inherit'});
if(initialized.status!==0)process.exit(initialized.status??1);
await import('./dev-test.mjs');
