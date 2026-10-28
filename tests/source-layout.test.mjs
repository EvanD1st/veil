import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {sourcePath,legacyModule} from '../scripts/source-layout.mjs';

test('source folders keep framework routing thin and client components free of backend imports',async()=>{
 for(const path of ['app/page.tsx','app/layout.tsx','app/api/auctions/route.ts']){const text=await readFile(path,'utf8');assert.match(text,/^export \{/m);assert.doesNotMatch(text,/export (async )?function/);}
 const text=await readFile('frontend/app/veil-app.tsx','utf8');assert.match(text,/use client/);assert.doesNotMatch(text,/@\/backend\//);assert.match(text,/@\/shared\/veil\/core/);
});

test('stable deployment module paths still load the actual authentication and presentation graph',async()=>{
 const root=await mkdtemp(join(tmpdir(),'veil-layout-'));await writeFile(join(root,'package.json'),'{"type":"module"}');await mkdir(join(root,'runtime'));await mkdir(join(root,'judging'));await mkdir(join(root,'scanner'));
 const runtime=['accounts.mjs','http-auth.mjs','auth-pages.mjs','auth-styles.mjs','auth-scene.mjs','auth-backdrop.mjs','reference-fonts.mjs','database.mjs','digital-config.mjs'];
 for(const name of runtime){const source=sourcePath('runtime/'+name);await writeFile(join(root,'runtime',name),legacyModule(await readFile(source,'utf8'),source));}
 await cp('backend/scanner/invoice.mjs',join(root,'scanner/invoice.mjs'));
 const module=await import(pathToFileURL(join(root,'runtime/http-auth.mjs')).href);assert.equal(typeof module.authenticationHandler,'function');
 const pages=await import(pathToFileURL(join(root,'runtime/auth-pages.mjs')).href);assert.match(pages.authPage('login','/').body,/Log in/);
});
