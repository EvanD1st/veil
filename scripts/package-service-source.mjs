// Public source only; preserves existing scanner/worker installation archive paths.
import {mkdir,readdir,readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
import {legacyPath,legacyModule} from './source-layout.mjs';
const output=resolve(process.argv[2]??'.sites-runtime/veil-service-source.tar'),staging=await mkdtemp(join(tmpdir(),'veil-service-source-'));
const roots=process.argv.slice(3);if(!roots.length)roots.push('judging','scanner');if(roots.some(x=>!['judging','scanner','escrow'].includes(x))||new Set(roots).size!==roots.length)throw Error('Choose distinct public service roots.');
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.name==='__pycache__')continue;const file=dir+'/'+e.name;if(e.isSymbolicLink())throw Error('Source archive cannot contain links.');if(e.isDirectory())await walk(file);else files.push(file);}}
for(const dir of roots)await walk('backend/'+dir);if(roots.includes('judging'))files.push('shared/judging/collection.json');
for(const file of files){const bytes=await readFile(file),dest=join(staging,legacyPath(file));await mkdir(dirname(dest),{recursive:true});await writeFile(dest,/\.(mjs|js)$/.test(file)?legacyModule(bytes.toString('utf8'),file):bytes);}
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();await mkdir(dirname(output),{recursive:true});
const python=process.platform==='win32'?'python':'python3';execFileSync(python,['-c',"import tarfile,sys,pathlib; root=pathlib.Path(sys.argv[1]); t=tarfile.open(sys.argv[2],'x',format=tarfile.PAX_FORMAT,pax_headers={'comment':sys.argv[3]}); [t.add(root/name,arcname=name,recursive=True) for name in sorted(p.name for p in root.iterdir())]; t.close()",staging,output,sha]);
console.log('Exported public scanner/worker sources with compatible installation paths.');
