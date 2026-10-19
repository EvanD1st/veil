import ts from 'typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const destination = resolve('.sites-runtime/test-build');
await mkdir(destination, { recursive: true });
await writeFile(`${destination}/package.json`, '{"type":"commonjs"}');
for (const file of ['lib/veil/core.ts', 'lib/veil/crypto.ts', 'lib/veil/server.ts', 'app/chatgpt-auth.ts']) {
  const output = resolve(destination, file.replace(/\.ts$/, '.js'));
  await mkdir(dirname(output), { recursive: true });
  const { outputText } = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  await writeFile(output, outputText);
}
const result = spawnSync(process.execPath, ['--test', 'tests/veil.test.cjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
