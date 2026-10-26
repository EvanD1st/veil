// Only generated public code/art is distributable. Private data belongs outside the artifact.
import {readdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='dist/standalone';
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;assert.ok(!e.isSymbolicLink(),'Artifact must not link to external storage.');assert.ok(!/\.(pem|sqlite|sqlite-wal|sqlite-shm|age|part)$/i.test(e.name),'Private data in release: '+p);assert.ok(!['digital-store','private-files','private-backups'].includes(e.name)&&p!==root+'/shared'&&!e.name.startsWith('.env'),'Private directory in release: '+p);if(e.isDirectory())await walk(p);}}
await walk(root);const release=JSON.parse(await readFile(root+'/release.json','utf8'));assert.equal(release.digitalMigrationSha256,createHash('sha256').update(await readFile(root+'/drizzle/0006_digital_delivery.sql')).digest('hex'));assert.equal(release.sharp,'0.35.4');assert.equal(release.assetsSha256,createHash('sha256').update(await readFile(root+'/proof-assets.json')).digest('hex'));
console.log('Public artifact excludes private databases, originals, wallet/key files and external links; migration provenance matches.');
