import ts from 'typescript';
import { mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const destination = resolve('.sites-runtime/test-build');
await mkdir(destination, { recursive: true });
await writeFile(`${destination}/package.json`, '{"type":"commonjs"}');
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(dir+'/'+e.name):dir+'/'+e.name))).flat();}
for (const file of [...await files('lib/veil'),'app/chatgpt-auth.ts'].filter(f=>/\.(ts|js|json)$/.test(f))) {
  const output = resolve(destination, file.replace(/\.ts$/, '.js'));
  await mkdir(dirname(output), { recursive: true });
  if(file.endsWith('.json')){await copyFile(file,output);continue;}
  const { outputText } = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  await writeFile(output, outputText);
}
const assets=JSON.parse(await readFile('lib/veil/zk/assets.json','utf8'));
await mkdir('.sites-runtime/zk-build/auction_js',{recursive:true});
for(const [name,target] of [['wasm','auction_js/auction.wasm'],['zkey','auction.zkey']]){await writeFile('.sites-runtime/zk-build/'+target,Buffer.concat(await Promise.all(assets[name].map(p=>readFile('public'+p.url)))));}
const result = spawnSync(process.execPath, ['--test', 'tests/veil.test.cjs','tests/worker.test.mjs','tests/scanner.test.mjs','tests/scanner-service.test.mjs','tests/testnet-startup.test.mjs','tests/escrow-standalone.cjs','tests/escrow-executor.test.mjs','tests/escrow-pczt.test.mjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
