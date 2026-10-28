// Run after the Node target build in Linux CI. Never reads deployment secrets or local databases.
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sourcePath,legacyModule} from './source-layout.mjs';
import {readdir} from 'node:fs/promises';
import {packageNativeImages} from './package-native-images.mjs';
const root='dist/standalone';
await packageNativeImages(root);
await mkdir(root+'/runtime',{recursive:true});
for(const name of ['accounts.mjs','admin.mjs','auth-pages.mjs','auth-styles.mjs','auth-scene.mjs','auth-backdrop.mjs','reference-fonts.mjs','database.mjs','digital-admin.mjs','digital-config.mjs','digital-files.mjs','digital-review.mjs','http-auth.mjs','judging-http.mjs','judging-store.mjs','migrations.mjs','node-auth.ts','server.mjs']){const file=sourcePath('runtime/'+name);await writeFile(root+'/runtime/'+name,legacyModule(await readFile(file,'utf8'),file));}
await cp('backend/drizzle',root+'/drizzle',{recursive:true});
await cp('frontend/public',root+'/public',{recursive:true});
await mkdir(root+'/judging',{recursive:true});await cp('shared/judging/collection.json',root+'/judging/collection.json');
await writeFile(root+'/judging/managed-client.mjs',legacyModule(await readFile('backend/judging/managed-client.mjs','utf8'),'backend/judging/managed-client.mjs'));
await mkdir(root+'/scanner',{recursive:true});await cp('backend/scanner/invoice.mjs',root+'/scanner/invoice.mjs');
await cp('shared/veil/zk/assets.json',root+'/proof-assets.json');
await cp('LICENSE',root+'/LICENSE');await cp('LICENSE-GPL-3.0',root+'/LICENSE-GPL-3.0');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await writeFile(root+'/release.json',JSON.stringify({commit:sha,node:process.version,target:'ubuntu-node-sqlite',sellerSetupMigrationSha256:createHash('sha256').update(await readFile('backend/drizzle/0009_digital_seller_setup.sql')).digest('hex'),judgingMigrationSha256:createHash('sha256').update(await readFile('backend/drizzle/0007_judging.sql')).digest('hex'),digitalMigrationSha256:createHash('sha256').update(await readFile('backend/drizzle/0006_digital_delivery.sql')).digest('hex'),sharp:'0.35.4',assetsSha256:createHash('sha256').update(await readFile('shared/veil/zk/assets.json')).digest('hex')},null,2)+'\n');
