// Run after the Node target build in Linux CI. Never reads deployment secrets or local databases.
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {packageNativeImages} from './package-native-images.mjs';
const root='dist/standalone';
await packageNativeImages(root);
await cp('runtime',root+'/runtime',{recursive:true});await cp('drizzle',root+'/drizzle',{recursive:true});
await mkdir(root+'/judging',{recursive:true});await cp('judging/collection.json',root+'/judging/collection.json');
await cp('judging/managed-client.mjs',root+'/judging/managed-client.mjs');
await mkdir(root+'/scanner',{recursive:true});await cp('scanner/invoice.mjs',root+'/scanner/invoice.mjs');
await cp('lib/veil/zk/assets.json',root+'/proof-assets.json');
await cp('LICENSE',root+'/LICENSE');await cp('LICENSE-GPL-3.0',root+'/LICENSE-GPL-3.0');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await writeFile(root+'/release.json',JSON.stringify({commit:sha,node:process.version,target:'ubuntu-node-sqlite',judgingMigrationSha256:createHash('sha256').update(await readFile('drizzle/0007_judging.sql')).digest('hex'),digitalMigrationSha256:createHash('sha256').update(await readFile('drizzle/0006_digital_delivery.sql')).digest('hex'),sharp:'0.35.4',assetsSha256:createHash('sha256').update(await readFile('lib/veil/zk/assets.json')).digest('hex')},null,2)+'\n');
