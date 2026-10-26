import {loadConfigFromFile} from 'vite';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
process.env.VEIL_LOCAL_TEST='1';
await assert.rejects(loadConfigFromFile({command:'build',mode:'production'},'vite.config.ts'),/development-only/);
delete process.env.VEIL_LOCAL_TEST;
async function files(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(dir+'/'+e.name):dir+'/'+e.name))).flat();}
for(const file of (await files('dist/server')).filter(p=>/\.[cm]?js$/.test(p))){
 const text=await readFile(file,'utf8');for(const marker of ['/__veil/','__veil_test_identity','quicknet-round-1000','__sites_local_auth','local_seedy','Explicit local synthetic file fixture','fixture-deliverable'])assert.ok(!text.includes(marker),'Local test hook leaked into '+file);
}
console.log('Production rejects local-test mode and contains no local identity/clock/fixture endpoints.');
